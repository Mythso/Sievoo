import { db, watchlistCompaniesTable } from "@workspace/db";
import { fetchTrendingTickers, lookupTicker } from "./market-data";
import { processCompany, type WatchlistJobResultItem } from "./watchlist-job";
import { getOsloTickers } from "./oslo-tickers";
import { logger } from "./logger";

// Cap how many brand-new tickers we onboard per run, so a spike in Yahoo's
// trending list (and the Yahoo Finance rate limits that come with fetching
// full valuations for each) can't overwhelm a single daily run.
const MAX_NEW_TICKERS_PER_RUN = 5;

// Oslo Børs companies onboarded per daily run (on top of the US trending
// cap above), so the whole Oslo list is covered within about a week
// without one run hammering Yahoo.
const MAX_NEW_OSLO_PER_RUN = 6;

/**
 * Daily discovery job: looks at Yahoo Finance's current trending US
 * tickers (plus the next few not-yet-covered companies from the Oslo Børs
 * list in oslo-tickers.ts), adds any that aren't already on the watchlist, and immediately
 * runs a full valuation + publish pass on each new one (via processCompany,
 * shared with the weekly watchlist-worker) so it shows up on the public
 * site right away instead of waiting for the next Monday refresh.
 * New companies get whatever defaults are set on the watchlist_companies
 * table (risk-free rate, market return, etc.) - the same as a company an
 * admin adds by hand with no custom settings.
 */
export async function runTrendingDiscovery(): Promise<WatchlistJobResultItem[]> {
  const results: WatchlistJobResultItem[] = [];

  let trending: string[] = [];
  try {
    trending = await fetchTrendingTickers();
  } catch (err) {
    // Keep going: the Oslo Børs onboarding below doesn't depend on it.
    logger.error({ err }, "Failed to fetch trending tickers from Yahoo Finance");
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
    results.push(await onboardTicker(ticker, "trending"));
    // Gentle delay between tickers to avoid hitting Yahoo Finance rate limits.
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  // Oslo Børs coverage: add the next few companies from the Oslo list that
  // aren't tracked yet.
  const osloMissing = getOsloTickers()
    .filter((t) => !existingSet.has(t) && !newTickers.includes(t))
    .slice(0, MAX_NEW_OSLO_PER_RUN);
  if (osloMissing.length > 0) {
    logger.info({ count: osloMissing.length }, "Onboarding Oslo Børs tickers");
  }
  for (const ticker of osloMissing) {
    results.push(await onboardTicker(ticker, "oslo"));
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return results;
}

/**
 * Adds one ticker to the watchlist (with its company name, if Yahoo knows
 * it) and immediately runs a full valuation + publish pass on it.
 */
async function onboardTicker(
  ticker: string,
  source: "trending" | "oslo",
): Promise<WatchlistJobResultItem> {
  try {
    let companyName: string | null = null;
    try {
      const lookup = await lookupTicker(ticker);
      companyName = lookup.companyName;
    } catch (lookupErr) {
      logger.warn({ err: lookupErr, ticker }, "Ticker name lookup failed, continuing without it");
    }

    const today = new Date().toISOString().slice(0, 10);
    const [inserted] = await db
      .insert(watchlistCompaniesTable)
      .values({
        ticker,
        companyName,
        source,
        // Norwegian tax rate and a NOK-appropriate risk-free rate for Oslo
        // listings; US defaults otherwise.
        ...(source === "oslo" ? { taxRate: 22.0, riskFreeRate: 4.0 } : {}),
        notes:
          source === "oslo"
            ? `Del av Oslo Børs-dekningen (lagt til ${today}).`
            : `Auto-oppdaget som trending ticker (Yahoo Finance) ${today}.`,
      })
      .onConflictDoNothing()
      .returning();

    if (!inserted) {
      // Ticker was added by something else in the meantime (e.g. an admin,
      // or a race with another run) - skip rather than double-process it.
      return { ticker, status: "ok" };
    }

    logger.info({ ticker, source }, "Added ticker to watchlist");
    return await processCompany(inserted);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, ticker }, "Failed to onboard ticker");
    return { ticker, status: "error", error_message: message };
  }
}
