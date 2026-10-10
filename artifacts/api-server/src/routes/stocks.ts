import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, analysesTable, tickerFollowsTable } from "@workspace/db";
import { TickerParam } from "@workspace/api-zod";
import {
  listStocks,
  getCompanyByTicker,
  getLatestOkValuation,
  getHistoryPoints,
  toStockSummary,
} from "../lib/stock-data";
import { getRequestUser } from "../lib/sessions";
import { analysisColumns, toApiAnalysis } from "./analyses";

const router: IRouter = Router();

// Public: every tracked stock with its latest AutoDCF / AutoValue numbers.
// Powers the /stocks directory page (and its server-rendered SEO version).
router.get("/stocks", async (_req, res): Promise<void> => {
  const items = await listStocks();
  res.set("Cache-Control", "public, max-age=300");
  res.json({ items });
});

// Public: everything the /stock/:ticker page needs in one call - latest
// numbers, full valuation history, community analyses of the ticker and
// how many people follow it (plus the caller's own follow, if logged in).
router.get("/stocks/:ticker", async (req, res): Promise<void> => {
  const params = TickerParam.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ticker" });
    return;
  }
  const ticker = params.data.ticker.toUpperCase();

  const company = await getCompanyByTicker(ticker);
  if (!company) {
    res.status(404).json({ error: `${ticker} is not tracked yet`, ticker });
    return;
  }

  const [latest, history, analyses, [{ followers }], user] = await Promise.all([
    getLatestOkValuation(company.id),
    getHistoryPoints(company.id),
    db
      .select(analysisColumns)
      .from(analysesTable)
      .where(eq(analysesTable.ticker, ticker))
      .orderBy(desc(analysesTable.createdAt))
      .limit(24),
    db
      .select({ followers: sql<number>`count(*)::int` })
      .from(tickerFollowsTable)
      .where(eq(tickerFollowsTable.ticker, ticker)),
    getRequestUser(req),
  ]);

  let myFollow = null;
  if (user) {
    const [follow] = await db
      .select()
      .from(tickerFollowsTable)
      .where(and(eq(tickerFollowsTable.userId, user.id), eq(tickerFollowsTable.ticker, ticker)));
    if (follow) {
      myFollow = {
        method: follow.method,
        min_margin_of_safety: follow.minMarginOfSafety,
        email_enabled: !!follow.emailEnabled,
      };
    }
  }

  res.json({
    stock: toStockSummary(company, latest ?? undefined, {
      runs: history.length,
      first: history[0] ? new Date(history[0].computed_at) : null,
    }),
    notes: company.notes,
    published_analysis_id: company.publishedAnalysisId,
    insider_transactions: latest?.insiderTransactionsJson ? safeJson(latest.insiderTransactionsJson) : [],
    history,
    analyses: analyses.map((a) => toApiAnalysis(a.row, a.commentsCount)),
    followers,
    my_follow: myFollow,
  });
});

function safeJson(raw: string): unknown[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default router;
