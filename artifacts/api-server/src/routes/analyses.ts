import { Router, type IRouter } from "express";
import { eq, desc, sql, ilike, and, type SQL } from "drizzle-orm";
import { db, analysesTable, commentsTable, watchlistCompaniesTable, watchlistValuationsTable } from "@workspace/db";
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
import { getRequestUser, publicName } from "../lib/sessions";
import { ensureTrackedInBackground } from "../lib/coverage";

const router: IRouter = Router();

// Correlated sub-select so list/detail responses carry a comment count
// without an N+1 query per card.
// (Fully qualified on purpose: drizzle renders a bare column reference as
// just "id" inside sql``, which would bind to comments.id here.)
const commentsCountSql = sql<number>`(select count(*)::int from comments c where c.analysis_id = "published_analyses"."id")`;

export const analysisColumns = {
  row: analysesTable,
  commentsCount: commentsCountSql,
};

type AnalysisRow = typeof analysesTable.$inferSelect;

export function toApiAnalysis(row: AnalysisRow, commentsCount = 0) {
  return {
    id: row.id,
    title: row.title,
    ticker: row.ticker,
    current_price: row.currentPrice,
    base_dcf: row.baseDcf,
    bear_dcf: row.bearDcf,
    bull_dcf: row.bullDcf,
    margin_of_safety: row.marginOfSafety,
    projection_years: row.projectionYears,
    user_notes: row.userNotes ?? null,
    full_inputs_json: row.fullInputsJson,
    likes_count: row.likesCount,
    created_at: row.createdAt.toISOString(),
    author_alias: row.authorAlias,
    has_edit_pin: !!row.editPin,
    user_id: row.userId ?? null,
    currency: row.currency ?? null,
    comments_count: commentsCount,
  };
}

async function selectAnalysis(id: number) {
  const [found] = await db.select(analysisColumns).from(analysesTable).where(eq(analysesTable.id, id));
  return found ?? null;
}

/**
 * Who may edit/delete an analysis: its owner (logged in) for account-owned
 * analyses; for anonymous analyses, whoever has the PIN (or anyone, if it
 * was published without a PIN - the original behaviour).
 */
async function canModify(
  req: Parameters<typeof getRequestUser>[0],
  existing: AnalysisRow,
  pin: string | null | undefined,
): Promise<boolean> {
  if (existing.userId != null) {
    const user = await getRequestUser(req);
    return user?.id === existing.userId;
  }
  return !existing.editPin || existing.editPin === pin;
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

  const { sort = "newest", ticker, limit = 20, offset = 0, user_id } = query.data;

  const filters: SQL[] = [];
  if (ticker) filters.push(ilike(analysesTable.ticker, `%${ticker}%`));
  if (user_id != null) filters.push(eq(analysesTable.userId, user_id));
  const where = filters.length ? and(...filters) : undefined;

  let baseQuery = db.select(analysisColumns).from(analysesTable).$dynamic();
  if (where) baseQuery = baseQuery.where(where);

  const orderCol =
    sort === "most_liked"
      ? desc(analysesTable.likesCount)
      : sort === "margin_of_safety"
        ? desc(analysesTable.marginOfSafety)
        : desc(analysesTable.createdAt);

  const rows = await baseQuery
    .orderBy(orderCol, desc(analysesTable.id))
    .limit(Math.min(Math.max(limit, 1), 100))
    .offset(Math.max(offset, 0));

  let countQuery = db.select({ count: sql<number>`count(*)::int` }).from(analysesTable).$dynamic();
  if (where) countQuery = countQuery.where(where);
  const [{ count }] = await countQuery;

  res.json(
    ListAnalysesResponse.parse({
      items: rows.map((r) => toApiAnalysis(r.row, r.commentsCount)),
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

  const { title, ticker, current_price, base_dcf, bear_dcf, bull_dcf, margin_of_safety, projection_years, user_notes, full_inputs_json, author_alias, edit_pin, currency } =
    parsed.data;

  // Logged-in publishers own the analysis: it's attributed to their public
  // name, shows on their profile and counts for the leaderboard, and they
  // can edit/delete it without a PIN.
  const user = await getRequestUser(req);
  const normalizedTicker = ticker.trim().toUpperCase();

  // Default the currency to what the watchlist knows for this ticker, so
  // e.g. an EQNR.OL analysis is shown in kr rather than $.
  let resolvedCurrency = currency?.toUpperCase() ?? null;
  if (!resolvedCurrency) {
    const [known] = await db
      .select({ currency: watchlistValuationsTable.currency })
      .from(watchlistValuationsTable)
      .innerJoin(watchlistCompaniesTable, eq(watchlistCompaniesTable.id, watchlistValuationsTable.companyId))
      .where(and(eq(watchlistCompaniesTable.ticker, normalizedTicker), sql`${watchlistValuationsTable.currency} is not null`))
      .orderBy(desc(watchlistValuationsTable.computedAt))
      .limit(1);
    resolvedCurrency = known?.currency ?? null;
  }

  const [row] = await db
    .insert(analysesTable)
    .values({
      title,
      ticker: normalizedTicker,
      currentPrice: current_price,
      baseDcf: base_dcf,
      bearDcf: bear_dcf,
      bullDcf: bull_dcf,
      marginOfSafety: margin_of_safety,
      projectionYears: projection_years ?? 5,
      userNotes: user_notes ?? null,
      fullInputsJson: full_inputs_json,
      authorAlias: user ? publicName(user) : author_alias,
      editPin: user ? null : (edit_pin ?? null),
      userId: user?.id ?? null,
      currency: resolvedCurrency,
    })
    .returning();

  if (user) ensureTrackedInBackground(normalizedTicker);

  res.status(201).json(CreateAnalysisResponse.parse(toApiAnalysis(row)));
});

router.get("/analyses/:id", async (req, res): Promise<void> => {
  const params = GetAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const found = await selectAnalysis(params.data.id);

  if (!found) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  res.json(GetAnalysisResponse.parse(toApiAnalysis(found.row, found.commentsCount)));
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

  if (!(await canModify(req, existing, parsed.data.pin))) {
    res.status(403).json({ error: existing.userId != null ? "Only the author can edit this analysis" : "Incorrect PIN" });
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
  if (parsed.data.projection_years != null) updates.projectionYears = parsed.data.projection_years;

  if (Object.keys(updates).length > 0) {
    await db.update(analysesTable).set(updates).where(eq(analysesTable.id, params.data.id));
  }
  const updated = await selectAnalysis(params.data.id);

  res.json(UpdateAnalysisResponse.parse(toApiAnalysis(updated!.row, updated!.commentsCount)));
});

router.delete("/analyses/:id", async (req, res): Promise<void> => {
  const params = DeleteAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = DeleteAnalysisBody.safeParse(req.body ?? {});
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

  if (!(await canModify(req, existing, parsed.data.pin))) {
    res.status(403).json({ error: existing.userId != null ? "Only the author can delete this analysis" : "Incorrect PIN" });
    return;
  }

  await db.delete(commentsTable).where(eq(commentsTable.analysisId, params.data.id));
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
