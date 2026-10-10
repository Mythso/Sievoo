import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, analysesTable, commentsTable, usersTable } from "@workspace/db";
import { UserIdParam } from "@workspace/api-zod";
import { publicName } from "../lib/sessions";
import { getTrackRecord, MIN_CALLS_FOR_RANKING } from "../lib/track-record";

const router: IRouter = Router();

/**
 * Public profile data for /u/:id: public name, member-since, activity and
 * the account's scored calls from the track record. Never includes the
 * email address.
 */
export async function loadProfile(userId: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) return null;

  const [[stats], [commentStats], record] = await Promise.all([
    db
      .select({
        analyses: sql<number>`count(*)::int`,
        likes: sql<number>`coalesce(sum(${analysesTable.likesCount}), 0)::int`,
      })
      .from(analysesTable)
      .where(eq(analysesTable.userId, userId)),
    db
      .select({ comments: sql<number>`count(*)::int` })
      .from(commentsTable)
      .where(eq(commentsTable.userId, userId)),
    getTrackRecord(),
  ]);

  const rankedIndex = record.leaderboard.filter((e) => e.ranked).findIndex((e) => e.user_id === userId);
  const entry = record.leaderboard.find((e) => e.user_id === userId) ?? null;

  return {
    id: user.id,
    name: publicName(user),
    created_at: user.createdAt.toISOString(),
    analyses_count: stats?.analyses ?? 0,
    total_likes: stats?.likes ?? 0,
    comments_count: commentStats?.comments ?? 0,
    track: entry
      ? {
          evaluated: entry.evaluated,
          hits: entry.hits,
          hit_rate: entry.hit_rate,
          avg_call_return: entry.avg_call_return,
          pending: entry.pending,
          rank: rankedIndex >= 0 ? rankedIndex + 1 : null,
          min_calls_for_ranking: MIN_CALLS_FOR_RANKING,
        }
      : null,
    calls: (record.calls_by_user.get(userId) ?? []).slice().reverse(),
  };
}

router.get("/users/:id", async (req, res): Promise<void> => {
  const params = UserIdParam.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }
  const profile = await loadProfile(params.data.id);
  if (!profile) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(profile);
});

export default router;
