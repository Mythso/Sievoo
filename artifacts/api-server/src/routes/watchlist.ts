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
} from "@workspace/api-zod";
import { verifyAdminToken } from "./admin";
import { runWatchlistUpdate } from "../lib/watchlist-job";
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

  try {
    const [row] = await db
      .insert(watchlistCompaniesTable)
      .values({
        ticker: ticker.toUpperCase(),
        companyName: company_name ?? null,
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
