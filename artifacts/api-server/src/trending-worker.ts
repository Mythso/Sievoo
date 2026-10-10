/**
 * Standalone entrypoint for the daily trending-ticker discovery job.
 * This is built to its own bundle (dist/trending-worker.mjs) and run as
 * a separate Railway service with a Cron Schedule, instead of the
 * always-on web server in index.ts. Runs daily, ahead of the weekly
 * watchlist-worker refresh.
 */
import { runTrendingDiscovery } from "./lib/trending-job";
import { runAlertCheck, sendWeeklyDigests } from "./lib/alerts";
import { logger } from "./lib/logger";

runTrendingDiscovery()
  .then(async (results) => {
    // Alerts (and, weekly, the digest) run right after fresh numbers land.
    // Failures here are logged but never fail the valuation run itself.
    await runAlertCheck().catch((err) => logger.error({ err }, "Alert check failed"));
    return results;
  })
  .then((results) => {
    const ok = results.filter((r) => r.status === "ok").length;
    const failed = results.filter((r) => r.status === "error").length;
    logger.info({ ok, failed, results }, "Trending worker run complete");
    process.exit(failed > 0 && ok === 0 ? 1 : 0);
  })
  .catch((err) => {
    logger.error({ err }, "Trending worker run failed");
    process.exit(1);
  });
