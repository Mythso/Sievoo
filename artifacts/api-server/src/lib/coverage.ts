import { eq } from "drizzle-orm";
import { db, watchlistCompaniesTable } from "@workspace/db";
import { lookupTicker } from "./market-data";
import { processCompany } from "./watchlist-job";
import { logger } from "./logger";

// Valid Yahoo-style symbols: "AAPL", "BRK-B", "EQNR.OL", "SHEL.L".
export const TICKER_PATTERN = /^[A-Z0-9][A-Z0-9-]{0,9}(\.[A-Z]{1,3})?$/;

export function normalizeTicker(raw: string): string {
  return raw.trim().toUpperCase();
}

// Global cap on how many tickers community publishing can add per day,
// so a burst of junk submissions can't flood the watchlist (or Yahoo).
const COMMUNITY_DAILY_CAP = 25;
let communityDay = "";
let communityAddedToday = 0;
const inFlight = new Set<string>();

/**
 * Makes sure a ticker a logged-in user just published an analysis for is
 * tracked by the watchlist, so it gets a /stock page, weekly AutoDCF /
 * AutoValue runs, and price history for scoring the analysis on the
 * leaderboard. Only real tickers (ones Yahoo can name) are added, with
 * auto-publish off so community-sourced tickers don't add bot cards to the
 * feed. Runs in the background - publishing never waits on Yahoo.
 */
export function ensureTrackedInBackground(rawTicker: string): void {
  const ticker = normalizeTicker(rawTicker);
  if (!TICKER_PATTERN.test(ticker) || inFlight.has(ticker)) return;

  const today = new Date().toISOString().slice(0, 10);
  if (today !== communityDay) {
    communityDay = today;
    communityAddedToday = 0;
  }
  if (communityAddedToday >= COMMUNITY_DAILY_CAP) return;

  inFlight.add(ticker);
  (async () => {
    try {
      const [existing] = await db
        .select({ id: watchlistCompaniesTable.id })
        .from(watchlistCompaniesTable)
        .where(eq(watchlistCompaniesTable.ticker, ticker));
      if (existing) return;

      const lookup = await lookupTicker(ticker);
      if (!lookup.companyName) return;

      const [inserted] = await db
        .insert(watchlistCompaniesTable)
        .values({
          ticker,
          companyName: lookup.companyName,
          source: "community",
          autoPublish: 0,
          notes: `Lagt til fordi en bruker publiserte en analyse ${today}.`,
        })
        .onConflictDoNothing()
        .returning();
      if (!inserted) return;

      communityAddedToday++;
      logger.info({ ticker }, "Community ticker added to watchlist");
      await processCompany(inserted);
    } catch (err) {
      logger.warn({ err, ticker }, "Could not add community ticker to watchlist");
    } finally {
      inFlight.delete(ticker);
    }
  })();
}
