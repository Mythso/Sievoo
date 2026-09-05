import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, watchlistCompaniesTable, watchlistValuationsTable } from "@workspace/db";
import {
  ListWatchlistResponse,
  AddWatchlistCompanyHeader,
  AddWatchlistCompanyBody,
  AddWatchlistCompanyResponse,
  DeleteWatchlistCompanyParams,
  DeleteWatchlistCompanyHeader,
  RefreshWatchlistHeader,
  RefreshWatchlistResponse,
  WatchlistHistoryParams,
  WatchlistHistoryHeader,
  WatchlistHistoryResponse,
} from "@workspace/api-zod";
import { verifyAdminToken } from "./admin";
import { runWatchlistUpdate } from "../lib/watchlist-job";
import { lookupTicker } from "../lib/market-data";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function toApiValuation(row: typeof watchlistValuationsTable.$inferSelect) {
  return {
    price: row.price,
    revenue: row.revenue,
    rev_growth: row.revGrowth,
    fcf_margin: row.fcfMargin,
    beta: row.beta,
    wacc: row.wacc,
    bear_dcf: row.bearDcf,
    base_dcf: row.baseDcf,
    bull_dcf: row.bullDcf,
    margin_of_safety: row.marginOfSafety,
    eps: row.eps,
    book_value_per_share: row.bookValuePerShare,
    graham_number: row.grahamNumber,
    graham_margin_of_safety: row.grahamMarginOfSafety,
    insider_score: row.insiderScore,
    insider_transactions: row.insiderTransactionsJson
      ? (() => {
          try {
            const parsed = JSON.parse(row.insiderTransactionsJson as string);
            return parsed.map((t: any) => ({
              filer: t.filer ?? null,
              relation: t.relation ?? null,
              transaction_text: t.transactionText ?? null,
              shares: t.shares ?? null,
              value: t.value ?? null,
              date: t.date ?? null,
            }));
          } catch {
            return null;
          }
        })()
      : null,
    status: row.status as "ok" | "error",
    error_message: row.errorMessage,
    computed_at: row.computedAt.toISOString(),
  };
}

// Public: list followed companies with their latest valuation snapshot.
router.get("/watchlist", async (_req, res): Promise<void> => {
  const companies = await db
    .select()
    .from(watchlistCompaniesTable)
    .orderBy(watchlistCompaniesTable.ticker);

  const valuations = await db
    .select()
    .from(watchlistValuationsTable)
    .orderBy(desc(watchlistValuationsTable.computedAt));

  const latestByCompany = new Map<number, (typeof valuations)[number]>();
  for (const v of valuations) {
    if (!latestByCompany.has(v.companyId)) latestByCompany.set(v.companyId, v);
  }

  const items = companies.map((c) => {
    const latest = latestByCompany.get(c.id);
    return {
      id: c.id,
      ticker: c.ticker,
      company_name: c.companyName,
      notes: c.notes,
      projection_years: c.projectionYears,
      auto_publish: !!c.autoPublish,
      published_analysis_id: c.publishedAnalysisId,
      added_at: c.addedAt.toISOString(),
      latest_valuation: latest ? toApiValuation(latest) : null,
    };
  });

  res.json(ListWatchlistResponse.parse({ items }));
});

// Admin: add a company to the watchlist.
router.post("/admin/watchlist", async (req, res): Promise<void> => {
  const headers = AddWatchlistCompanyHeader.safeParse({
    "x-admin-token": req.headers["x-admin-token"],
  });
  if (!headers.success || !(await verifyAdminToken(headers.data["x-admin-token"]))) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = AddWatchlistCompanyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { ticker, company_name, notes, projection_years, auto_publish } = parsed.data;

  // Auto-fill the company name from the ticker if the caller didn't provide
  // one, so adding a company only ever requires typing the ticker.
  let resolvedCompanyName = company_name ?? null;
  if (!resolvedCompanyName) {
    try {
      const lookup = await lookupTicker(ticker);
      resolvedCompanyName = lookup.companyName;
    } catch (lookupErr) {
      logger.warn({ err: lookupErr, ticker }, "Company name lookup failed while adding watchlist company");
    }
  }

  try {
    const [row] = await db
      .insert(watchlistCompaniesTable)
      .values({
        ticker: ticker.toUpperCase(),
        companyName: resolvedCompanyName,
        notes: notes ?? null,
        projectionYears: projection_years ?? 5,
        autoPublish: auto_publish === false ? 0 : 1,
      })
      .returning();

    res.status(201).json(
      AddWatchlistCompanyResponse.parse({
        id: row.id,
        ticker: row.ticker,
        company_name: row.companyName,
        notes: row.notes,
        projection_years: row.projectionYears,
        auto_publish: !!row.autoPublish,
        published_analysis_id: row.publishedAnalysisId,
        added_at: row.addedAt.toISOString(),
        latest_valuation: null,
      }),
    );
  } catch (err) {
    logger.error({ err, ticker }, "Failed to add watchlist company");
    res.status(409).json({ error: `Could not add ${ticker}. It may already be on the watchlist.` });
  }
});

// Admin: remove a company from the watchlist.
router.delete("/admin/watchlist/:id", async (req, res): Promise<void> => {
  const headers = DeleteWatchlistCompanyHeader.safeParse({
    "x-admin-token": req.headers["x-admin-token"],
  });
  if (!headers.success || !(await verifyAdminToken(headers.data["x-admin-token"]))) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = DeleteWatchlistCompanyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(watchlistCompaniesTable)
    .where(eq(watchlistCompaniesTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  res.sendStatus(204);
});

// Admin: full valuation history for one company, for the Statistics tab -
// every past AutoDCF/AutoValue run, oldest first, so price vs. DCF vs.
// Graham Number can be plotted over time and checked against reality years
// later. Capped so a long-followed ticker can't return an unbounded payload.
const MAX_HISTORY_POINTS = 500;

router.get("/admin/watchlist/:id/history", async (req, res): Promise<void> => {
  const headers = WatchlistHistoryHeader.safeParse({
    "x-admin-token": req.headers["x-admin-token"],
  });
  if (!headers.success || !(await verifyAdminToken(headers.data["x-admin-token"]))) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = WatchlistHistoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [company] = await db
    .select()
    .from(watchlistCompaniesTable)
    .where(eq(watchlistCompaniesTable.id, params.data.id));

  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  const rows = await db
    .select()
    .from(watchlistValuationsTable)
    .where(eq(watchlistValuationsTable.companyId, company.id))
    .orderBy(watchlistValuationsTable.computedAt);

  // Only successful runs have numbers worth plotting; failed runs (e.g. a
  // transient Yahoo Finance outage) are skipped rather than showing as gaps.
  const points = rows
    .filter((r) => r.status === "ok")
    .slice(-MAX_HISTORY_POINTS)
    .map((r) => ({
      computed_at: r.computedAt.toISOString(),
      price: r.price,
      bear_dcf: r.bearDcf,
      base_dcf: r.baseDcf,
      bull_dcf: r.bullDcf,
      margin_of_safety: r.marginOfSafety,
      graham_number: r.grahamNumber,
      graham_margin_of_safety: r.grahamMarginOfSafety,
    }));

  res.json(
    WatchlistHistoryResponse.parse({
      id: company.id,
      ticker: company.ticker,
      company_name: company.companyName,
      points,
    }),
  );
});

// Admin: manually trigger a refresh run (same job the weekly cron worker runs).
router.post("/admin/watchlist/refresh", async (req, res): Promise<void> => {
  const headers = RefreshWatchlistHeader.safeParse({
    "x-admin-token": req.headers["x-admin-token"],
  });
  if (!headers.success || !(await verifyAdminToken(headers.data["x-admin-token"]))) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const results = await runWatchlistUpdate();
    const updated = results.filter((r) => r.status === "ok").length;
    const failed = results.filter((r) => r.status === "error").length;
    res.json(RefreshWatchlistResponse.parse({ updated, failed, results }));
  } catch (err) {
    logger.error({ err }, "Manual watchlist refresh failed");
    res.status(500).json({ error: "Refresh failed" });
  }
});

export default router;
