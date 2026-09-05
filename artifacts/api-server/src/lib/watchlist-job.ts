import crypto from "crypto";
import { eq } from "drizzle-orm";
import {
  db,
  watchlistCompaniesTable,
  watchlistValuationsTable,
  analysesTable,
} from "@workspace/db";
import { fetchMarketData, fetchInsiderData, type MarketData } from "./market-data";
import { calculateDcf, calculateGraham, type DcfResult, type GrahamResult } from "./valuation";
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
  graham: GrahamResult,
  insiderScore: number,): Promise<number | null> {
  if (!company.autoPublish) return company.publishedAnalysisId;

  const title = `${company.companyName ?? company.ticker} (${company.ticker}) \u2014 Auto DCF`;
  const grahamNote =
    graham.grahamNumber != null
      ? ` Graham-tall (AutoValue): $${graham.grahamNumber.toFixed(2)}.`
      : "";
  const notes =
    `Automatisk generert av Sievoo sin ukentlig overv\u00e5kingsjobb (Yahoo Finance-data). ` +
    `Insider-score: ${insiderScore}/100.${grahamNote} Sist oppdatert: ${new Date().toISOString().slice(0, 10)}.`;

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
      g: company.terminalGrowth,
      cash: market.cash,
      debtTotal: market.debtTotal,
      shares: market.shares,
      currentPrice: market.price,
    });

    // AutoValue: Graham Number, computed the same way and on the same
    // schedule as AutoDCF above, from the same market data fetch.
    const graham = calculateGraham({
      eps: market.eps ?? 0,
      bookValuePerShare: market.bookValuePerShare ?? 0,
      currentPrice: market.price,
    });

    await db.insert(watchlistValuationsTable).values({
      companyId: company.id,
      ticker: company.ticker,
      price: market.price,
      revenue: market.revenue,
      revGrowth: market.revGrowth,
      fcfMargin: market.fcfMargin,
      beta: market.beta,
      shares: market.shares,
      cash: market.cash,
      debtTotal: market.debtTotal,
      wacc: dcf.wacc,
      bearDcf: dcf.bear,
      baseDcf: dcf.base,
      bullDcf: dcf.bull,
      marginOfSafety: dcf.marginOfSafety,
      eps: market.eps,
      bookValuePerShare: market.bookValuePerShare,
      grahamNumber: graham.grahamNumber,
      grahamMarginOfSafety: graham.marginOfSafety,
      insiderScore,
      insiderTransactionsJson,
      rawJson: JSON.stringify({ market, dcf, graham }),
      status: "ok",
    });

    try {
      await publishOrUpdateAnalysis(company, market, dcf, graham, insiderScore);
    } catch (publishErr) {
      logger.warn(
        { err: publishErr, ticker: company.ticker },
        "Failed to auto-publish community analysis",
      );
    }

    logger.info({ ticker: company.ticker }, "Watchlist valuation updated");
    return { ticker: company.ticker, status: "ok" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, ticker: company.ticker }, "Watchlist valuation failed");

    await db.insert(watchlistValuationsTable).values({
      companyId: company.id,
      ticker: company.ticker,
      status: "error",
      errorMessage: message,
    });

    return { ticker: company.ticker, status: "error", error_message: message };
  }
}

/**
 * Refreshes every company on the watchlist: see processCompany above for the
 * per-company logic. Each company is isolated (errors inside processCompany
 * are caught there), so one bad ticker doesn't stop the rest of the run.
 */
export async function runWatchlistUpdate(): Promise<WatchlistJobResultItem[]> {
  const companies = await db.select().from(watchlistCompaniesTable);
  const results: WatchlistJobResultItem[] = [];

  for (const company of companies) {
    results.push(await processCompany(company));

    // Gentle delay between tickers to avoid hitting Yahoo Finance rate limits.
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return results;
}
