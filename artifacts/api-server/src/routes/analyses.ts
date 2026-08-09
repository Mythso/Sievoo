import { Router, type IRouter } from "express";
import { eq, desc, sql, ilike } from "drizzle-orm";
import { db, analysesTable } from "@workspace/db";
import {
  CreateAnalysisBody,
  UpdateAnalysisBody,
  UpdateAnalysisParams,
  DeleteAnalysisBody,
  DeleteAnalysisParams,
  GetAnalysisParams,
  LikeAnalysisParams,
  ListAnalysesQueryParams,
  ListAnalysesResponse,
  CreateAnalysisResponse,
  GetAnalysisResponse,
  UpdateAnalysisResponse,
  LikeAnalysisResponse,
  GetCommunityStatsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function toApiAnalysis(row: typeof analysesTable.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    ticker: row.ticker,
    current_price: row.currentPrice,
    base_dcf: row.baseDcf,
    bear_dcf: row.bearDcf,
    bull_dcf: row.bullDcf,
    margin_of_safety: row.marginOfSafety,
    user_notes: row.userNotes ?? null,
    full_inputs_json: row.fullInputsJson,
    likes_count: row.likesCount,
    created_at: row.createdAt.toISOString(),
    author_alias: row.authorAlias,
    has_edit_pin: !!row.editPin,
  };
}

router.get("/analyses/stats", async (_req, res): Promise<void> => {
  const [{ totalAnalyses }] = await db
    .select({ totalAnalyses: sql<number>`count(*)::int` })
    .from(analysesTable);

  const [{ totalLikes }] = await db
    .select({ totalLikes: sql<number>`coalesce(sum(likes_count), 0)::int` })
    .from(analysesTable);

  const topTickers = await db
    .select({
      ticker: analysesTable.ticker,
      count: sql<number>`count(*)::int`,
    })
    .from(analysesTable)
    .groupBy(analysesTable.ticker)
    .orderBy(desc(sql`count(*)`))
    .limit(5);

  res.json(
    GetCommunityStatsResponse.parse({
      total_analyses: totalAnalyses,
      total_likes: totalLikes,
      top_tickers: topTickers,
    }),
  );
});

router.get("/analyses", async (req, res): Promise<void> => {
  const query = ListAnalysesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { sort = "newest", ticker, limit = 20, offset = 0 } = query.data;

  let baseQuery = db.select().from(analysesTable).$dynamic();

  if (ticker) {
    baseQuery = baseQuery.where(ilike(analysesTable.ticker, `%${ticker}%`));
  }

  const orderCol =
    sort === "most_liked"
      ? desc(analysesTable.likesCount)
      : sort === "margin_of_safety"
        ? desc(analysesTable.marginOfSafety)
        : desc(analysesTable.createdAt);

  const rows = await baseQuery.orderBy(orderCol).limit(limit).offset(offset);

  let countQuery = db.select({ count: sql<number>`count(*)::int` }).from(analysesTable).$dynamic();
  if (ticker) {
    countQuery = countQuery.where(ilike(analysesTable.ticker, `%${ticker}%`));
  }
  const [{ count }] = await countQuery;

  res.json(
    ListAnalysesResponse.parse({
      items: rows.map(toApiAnalysis),
      total: count,
    }),
  );
});

router.post("/analyses", async (req, res): Promise<void> => {
  const parsed = CreateAnalysisBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { title, ticker, current_price, base_dcf, bear_dcf, bull_dcf, margin_of_safety, user_notes, full_inputs_json, author_alias, edit_pin } =
    parsed.data;

  const [row] = await db
    .insert(analysesTable)
    .values({
      title,
      ticker: ticker.toUpperCase(),
      currentPrice: current_price,
      baseDcf: base_dcf,
      bearDcf: bear_dcf,
      bullDcf: bull_dcf,
      marginOfSafety: margin_of_safety,
      userNotes: user_notes ?? null,
      fullInputsJson: full_inputs_json,
      authorAlias: author_alias,
      editPin: edit_pin ?? null,
    })
    .returning();

  res.status(201).json(CreateAnalysisResponse.parse(toApiAnalysis(row)));
});

router.get("/analyses/:id", async (req, res): Promise<void> => {
  const params = GetAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(analysesTable)
    .where(eq(analysesTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  res.json(GetAnalysisResponse.parse(toApiAnalysis(row)));
});

router.patch("/analyses/:id", async (req, res): Promise<void> => {
  const params = UpdateAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateAnalysisBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(analysesTable)
    .where(eq(analysesTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  if (existing.editPin && existing.editPin !== parsed.data.pin) {
    res.status(403).json({ error: "Incorrect PIN" });
    return;
  }

  const updates: Partial<typeof analysesTable.$inferInsert> = {};
  if (parsed.data.title != null) updates.title = parsed.data.title;
  if (parsed.data.user_notes != null) updates.userNotes = parsed.data.user_notes;
  if (parsed.data.full_inputs_json != null) updates.fullInputsJson = parsed.data.full_inputs_json;
  if (parsed.data.current_price != null) updates.currentPrice = parsed.data.current_price;
  if (parsed.data.base_dcf != null) updates.baseDcf = parsed.data.base_dcf;
  if (parsed.data.bear_dcf != null) updates.bearDcf = parsed.data.bear_dcf;
  if (parsed.data.bull_dcf != null) updates.bullDcf = parsed.data.bull_dcf;
  if (parsed.data.margin_of_safety != null) updates.marginOfSafety = parsed.data.margin_of_safety;

  const [updated] = await db
    .update(analysesTable)
    .set(updates)
    .where(eq(analysesTable.id, params.data.id))
    .returning();

  res.json(UpdateAnalysisResponse.parse(toApiAnalysis(updated)));
});

router.delete("/analyses/:id", async (req, res): Promise<void> => {
  const params = DeleteAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = DeleteAnalysisBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(analysesTable)
    .where(eq(analysesTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  if (existing.editPin && existing.editPin !== parsed.data.pin) {
    res.status(403).json({ error: "Incorrect PIN" });
    return;
  }

  await db.delete(analysesTable).where(eq(analysesTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/analyses/:id/like", async (req, res): Promise<void> => {
  const params = LikeAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [updated] = await db
    .update(analysesTable)
    .set({ likesCount: sql`${analysesTable.likesCount} + 1` })
    .where(eq(analysesTable.id, params.data.id))
    .returning({ likesCount: analysesTable.likesCount });

  if (!updated) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  res.json(LikeAnalysisResponse.parse({ likes_count: updated.likesCount }));
});

export default router;
