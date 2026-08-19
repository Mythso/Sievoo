import { db, watchlistCompaniesTable, watchlistValuationsTable } from "@workspace/db";
import { fetchMarketData } from "./market-data";
import { calculateDcf } from "./valuation";
import { logger } from "./logger";

export interface WatchlistJobResultItem {
  ticker: string;
  status: "ok" | "error";
  error_message?: string;
}

/**
 * Refreshes every company on the watchlist: fetches price + fundamentals
 * from Yahoo Finance, runs the bear/base/bull DCF, and stores a snapshot.
 * Each company is isolated in its own try/catch so one bad ticker
 * doesn't stop the rest of the run.
 */
export async function runWatchlistUpdate(): Promise<WatchlistJobResultItem[]> {
  const companies = await db.select().from(watchlistCompaniesTable);
  const results: WatchlistJobResultItem[] = [];

  for (const company of companies) {
    try {
      const market = await fetchMarketData(company.ticker);

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
        rawJson: JSON.stringify({ market, dcf }),
        status: "ok",
      });

      logger.info({ ticker: company.ticker }, "Watchlist valuation updated");
      results.push({ ticker: company.ticker, status: "ok" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, ticker: company.ticker }, "Watchlist valuation failed");

      await db.insert(watchlistValuationsTable).values({
        companyId: company.id,
        ticker: company.ticker,
        status: "error",
        errorMessage: message,
      });

      results.push({ ticker: company.ticker, status: "error", error_message: message });
    }

    // Gentle delay between tickers to avoid hitting Yahoo Finance rate limits.
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return results;
}
