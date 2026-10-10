import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, commentsTable, analysesTable } from "@workspace/db";
import {
  ListCommentsParams,
  ListCommentsResponse,
  CreateCommentParams,
  CreateCommentBody,
  CreateCommentResponse,
} from "@workspace/api-zod";
import { getRequestUser, publicName } from "../lib/sessions";

const router: IRouter = Router();

// Per-account comment rate limit (in-memory, per process - same approach
// as the login rate limiters): 20 comments per hour is plenty for real
// discussion and stops a script from flooding a thread.
const commentBuckets = new Map<number, { count: number; resetAt: number }>();
function allowComment(userId: number): boolean {
  const now = Date.now();
  const bucket = commentBuckets.get(userId);
  if (!bucket || now > bucket.resetAt) {
    commentBuckets.set(userId, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (bucket.count >= 20) return false;
  bucket.count++;
  return true;
}

function toApiComment(row: typeof commentsTable.$inferSelect) {
  return {
    id: row.id,
    analysis_id: row.analysisId,
    author_name: row.authorName,
    comment_text: row.commentText,
    created_at: row.createdAt.toISOString(),
    user_id: row.userId ?? null,
  };
}

router.get("/analyses/:id/comments", async (req, res): Promise<void> => {
  const params = ListCommentsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const rows = await db
    .select()
    .from(commentsTable)
    .where(eq(commentsTable.analysisId, params.data.id))
    .orderBy(asc(commentsTable.createdAt));

  res.json(ListCommentsResponse.parse(rows.map(toApiComment)));
});

router.post("/analyses/:id/comments", async (req, res): Promise<void> => {
  // Commenting requires an account: every comment has an identity, which
  // keeps discussion accountable and spam out.
  const user = await getRequestUser(req);
  if (!user) {
    res.status(401).json({ error: "Log in to comment" });
    return;
  }
  if (!allowComment(user.id)) {
    res.status(429).json({ error: "You're commenting too fast. Try again in a while." });
    return;
  }

  const params = CreateCommentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateCommentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [analysis] = await db
    .select({ id: analysesTable.id })
    .from(analysesTable)
    .where(eq(analysesTable.id, params.data.id));

  if (!analysis) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  const [row] = await db
    .insert(commentsTable)
    .values({
      analysisId: params.data.id,
      authorName: publicName(user),
      commentText: parsed.data.comment_text.trim(),
      userId: user.id,
    })
    .returning();

  res.status(201).json(CreateCommentResponse.parse(toApiComment(row)));
});

export default router;
