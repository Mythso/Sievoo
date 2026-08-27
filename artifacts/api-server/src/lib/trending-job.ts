import { db, watchlistCompaniesTable } from "@workspace/db";
import { fetchTrendingTickers, lookupTicker } from "./market-data";
import { processCompany, type WatchlistJobResultItem } from "./watchlist-job";
import { logger } from "./logger";

// Cap how many brand-new tickers we onboard per run, so a spike in Yahoo's
// trending list (and the Yahoo Finance rate limits that come with fetching
// full valuations for each) can't overwhelm a single daily run.
const MAX_NEW_TICKERS_PER_RUN = 5;

/**
 * Daily discovery job: looks at Yahoo Finance's current trending US
 * tickers, adds any that aren't already on the watchlist, and immediately
 * runs a full valuation + publish pass on each new one (via processCompany,
 * shared with the weekly watchlist-worker) so it shows up on the public
 * site right away instead of waiting for the next Monday refresh.
 * New companies get whatever defaults are set on the watchlist_companies
 * table (risk-free rate, market return, etc.) - the same as a company an
 * admin adds by hand with no custom settings.
 */
export async function runTrendingDiscovery(): Promise<WatchlistJobResultItem[]> {
  const results: WatchlistJobResultItem[] = [];

  let trending: string[];
  try {
    trending = await fetchTrendingTickers();
  } catch (err) {
    logger.error({ err }, "Failed to fetch trending tickers from Yahoo Finance");
    return results;
  }

  const existing = await db
    .select({ ticker: watchlistCompaniesTable.ticker })
    .from(watchlistCompaniesTable);
  const existingSet = new Set(existing.map((c) => c.ticker.toUpperCase()));

  const newTickers = trending
    .map((t) => t.toUpperCase())
    .filter((t) => !existingSet.has(t))
    .slice(0, MAX_NEW_TICKERS_PER_RUN);

  logger.info(
    { trendingCount: trending.length, newCount: newTickers.length },
    "Trending discovery run starting",
  );

  for (const ticker of newTickers) {
    try {
      let companyName: string | null = null;
      try {
        const lookup = await lookupTicker(ticker);
        companyName = lookup.companyName;
      } catch (lookupErr) {
        logger.warn(
          { err: lookupErr, ticker },
          "Ticker name lookup failed, continuing without it",
        );
      }

      const [inserted] = await db
        .insert(watchlistCompaniesTable)
        .values({
          ticker,
          companyName,
          source: "trending",
          notes: `Auto-oppdaget som trending ticker (Yahoo Finance) ${new Date()
            .toISOString()
            .slice(0, 10)}.`,
        })
        .onConflictDoNothing()
        .returning();

      if (!inserted) {
        // Ticker was added by something else in the meantime (e.g. an admin,
        // or a race with another run) - skip rather than double-process it.
        continue;
      }

      logger.info({ ticker }, "Added trending ticker to watchlist");
      results.push(await processCompany(inserted));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, ticker }, "Failed to onboard trending ticker");
      results.push({ ticker, status: "error", error_message: message });
    }

    // Gentle delay between tickers to avoid hitting Yahoo Finance rate limits.
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return results;
}
