import { Router, type IRouter } from "express";
import { getTrackRecord, HORIZONS, MIN_CALL_AGE_DAYS, MIN_CALLS_FOR_RANKING } from "../lib/track-record";

const router: IRouter = Router();

// Public: method accuracy (AutoDCF vs Graham) and the analyst leaderboard.
router.get("/track-record", async (_req, res): Promise<void> => {
  const record = await getTrackRecord();
  res.set("Cache-Control", "public, max-age=300");
  res.json({
    generated_at: record.generated_at,
    tracking_since: record.tracking_since,
    snapshots: record.snapshots,
    companies_tracked: record.companies_tracked,
    horizons: HORIZONS,
    min_call_age_days: MIN_CALL_AGE_DAYS,
    min_calls_for_ranking: MIN_CALLS_FOR_RANKING,
    methods: record.methods,
    leaderboard: record.leaderboard.slice(0, 100),
  });
});

export default router;
