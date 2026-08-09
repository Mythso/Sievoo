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

const router: IRouter = Router();

function toApiComment(row: typeof commentsTable.$inferSelect) {
  return {
    id: row.id,
    analysis_id: row.analysisId,
    author_name: row.authorName,
    comment_text: row.commentText,
    created_at: row.createdAt.toISOString(),
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
      authorName: parsed.data.author_name,
      commentText: parsed.data.comment_text,
    })
    .returning();

  res.status(201).json(CreateCommentResponse.parse(toApiComment(row)));
});

export default router;
