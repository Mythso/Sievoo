import crypto from "crypto";
import { eq } from "drizzle-orm";
import {
  db,
  watchlistCompaniesTable,
  watchlistValuationsTable,
  analysesTable,
} from "@workspace/db";
import { fetchMarketData, fetchInsiderData, type MarketData } from "./market-data";
import { calculateDcf, type DcfResult } from "./valuation";
import { logger } from "./logger";

export interface WatchlistJobResultItem {
  ticker: string;
  status: "ok" | "error";
  error_message?: string;
}

/**
 * Publishes (or updates, if already published) the community "analysis"
 * card for a watchlist company, so visitors see fresh weekly DCF numbers
 * on the public site without an admin manually running the calculator.
 * Uses a random, never-shared edit PIN so the public PATCH/DELETE
 * endpoints (which require a PIN) can't be used to tamper with it.
 */
async function publishOrUpdateAnalysis(
  company: typeof watchlistCompaniesTable.$inferSelect,
  market: MarketData,
  dcf: DcfResult,
  insiderScore: number,): Promise<number | null> {
  if (!company.autoPublish) return company.publishedAnalysisId;

  const title = `${company.companyName ?? company.ticker} (${company.ticker}) \u2014 Auto DCF`;
  const notes =
    `Automatisk generert av Sievoo sin ukentlig overv\u00e5kingsjobb (Yahoo Finance-data). ` +
    `Insider-score: ${insiderScore}/100. Sist oppdatert: ${new Date().toISOString().slice(0, 10)}.`;

  const fullInputs = {
    inputs: {
      rf: company.riskFreeRate,
      beta: market.beta,
      rm: company.marketReturn,
      e: market.price * market.shares,
      d: market.debtTotal,
      rd: company.costOfDebt,
      tc: company.taxRate,
      baseRev: market.revenue,
      revGrowth: market.revGrowth,
      fcfMargin: market.fcfMargin,
      cushion: company.cushion,
      projectionYears: company.projectionYears,
      tvMethod: "perpetuity",
      g: company.terminalGrowth,
      ebitdaMultiple: 15,
      ebitdaY5: 0,
      cash: market.cash,
      debtTotal: market.debtTotal,
      shares: market.shares,
      currentPrice: market.price,
      wActual: 0,
    },
    gates: { moat: false, ceo: false },
    scores: { insider: insiderScore, thesis: 50 },
  };

  const values = {
    title,
    ticker: company.ticker,
    currentPrice: market.price,
    baseDcf: dcf.base,
    bearDcf: dcf.bear,
    bullDcf: dcf.bull,
    marginOfSafety: dcf.marginOfSafety,
    projectionYears: company.projectionYears,
    userNotes: notes,
    fullInputsJson: JSON.stringify(fullInputs),
    authorAlias: "Sievoo Auto-DCF",
  };

  if (company.publishedAnalysisId) {
    const [updated] = await db
      .update(analysesTable)
      .set(values)
      .where(eq(analysesTable.id, company.publishedAnalysisId))
      .returning({ id: analysesTable.id });

    if (updated) return updated.id;
    // Linked analysis was deleted elsewhere (e.g. manually in admin) \u2014 fall
    // through and create a fresh one below instead of erroring the run.
  }

  const editPin = crypto.randomBytes(16).toString("hex");
  const [created] = await db
    .insert(analysesTable)
    .values({ ...values, editPin, likesCount: 0 })
    .returning({ id: analysesTable.id });

  if (created) {
    await db
      .update(watchlistCompaniesTable)
      .set({ publishedAnalysisId: created.id })
      .where(eq(watchlistCompaniesTable.id, company.id));
    return created.id;
  }

  return null;
}

/**
 * Refreshes a single watchlist company: fetches price + fundamentals from
 * Yahoo Finance, runs the bear/base/bull DCF, stores a snapshot, and
 * (if auto-publish is on) updates its public community analysis card.
 * Shared by both the weekly watchlist-worker (every company) and the daily
 * trending-worker (just-added trending tickers).
 */
export async function processCompany(
  company: typeof watchlistCompaniesTable.$inferSelect,): Promise<WatchlistJobResultItem> {
  try {
    const market = await fetchMarketData(company.ticker);

    // Insider data isn't available for every ticker (esp. smaller/non-US
    // listings), so a failure here falls back to a neutral score instead
    // of failing the whole company's valuation.
    let insiderScore = 50;
    let insiderTransactionsJson: string | null = null;
    try {
      const insider = await fetchInsiderData(company.ticker);
      insiderScore = insider.score;
      insiderTransactionsJson = JSON.stringify(insider.transactions);
    } catch (insiderErr) {
      logger.warn(
        { err: insiderErr, ticker: company.ticker },
        "Insider data unavailable, using neutral score",
      );
    }

    const dcf = calculateDcf({
