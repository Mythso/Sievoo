import { asc, eq, isNotNull } from "drizzle-orm";
import {
  db,
  analysesTable,
  usersTable,
  watchlistCompaniesTable,
  watchlistValuationsTable,
} from "@workspace/db";
import { publicName } from "./sessions";

/**
 * Public track record: how well valuations turned out after the fact.
 *
 * 1. Method accuracy (AutoDCF vs AutoValue/Graham): every stored watchlist
 *    snapshot is a "call" - undervalued if the method's value is above the
 *    price that day, overvalued if below. After N days we check whether the
 *    price moved the way the call implied. Snapshots are append-only, so
 *    this can't be rewritten after the fact.
 *
 * 2. Analyst leaderboard: every analysis published by a logged-in account
 *    is a call (positive margin of safety = bullish, negative = bearish).
 *    The starting price is the watchlist's own recorded price nearest the
 *    publish date - never the price the author typed in - and the outcome
 *    is the latest recorded price at least 30 days later. Same rule for
 *    everyone, no self-reported numbers.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
export const HORIZONS = [30, 90, 365] as const;
export const MIN_CALL_AGE_DAYS = 30;
export const MIN_CALLS_FOR_RANKING = 3;

interface Snapshot {
  t: number;
  price: number;
  dcf: number | null;
  graham: number | null;
  currency: string | null;
}

export interface MethodHorizonStats {
  method: "dcf" | "graham";
  horizon_days: number;
  calls: number;
  hits: number;
  hit_rate: number | null;
  avg_return_when_undervalued: number | null;
  avg_return_when_overvalued: number | null;
  toward_value_rate: number | null;
  companies: number;
}

export interface UserCall {
  analysis_id: number;
  ticker: string;
  published_at: string;
  bullish: boolean;
  price_then: number;
  price_now: number;
  currency: string | null;
  return_pct: number;
  hit: boolean;
}

export interface LeaderboardEntry {
  user_id: number;
  name: string;
  evaluated: number;
  hits: number;
  hit_rate: number;
  avg_call_return: number;
  pending: number;
  ranked: boolean;
}

export interface TrackRecord {
  generated_at: string;
  tracking_since: string | null;
  snapshots: number;
  companies_tracked: number;
  methods: MethodHorizonStats[];
  leaderboard: LeaderboardEntry[];
  calls_by_user: Map<number, UserCall[]>;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

async function loadSnapshots(): Promise<Map<number, Snapshot[]>> {
  const rows = await db
    .select({
      companyId: watchlistValuationsTable.companyId,
      computedAt: watchlistValuationsTable.computedAt,
      price: watchlistValuationsTable.price,
      baseDcf: watchlistValuationsTable.baseDcf,
      grahamNumber: watchlistValuationsTable.grahamNumber,
      currency: watchlistValuationsTable.currency,
    })
    .from(watchlistValuationsTable)
    .where(eq(watchlistValuationsTable.status, "ok"))
    .orderBy(asc(watchlistValuationsTable.computedAt));

  const byCompany = new Map<number, Snapshot[]>();
  for (const r of rows) {
    if (r.price == null || !(r.price > 0)) continue;
    const list = byCompany.get(r.companyId) ?? [];
    list.push({ t: r.computedAt.getTime(), price: r.price, dcf: r.baseDcf, graham: r.grahamNumber, currency: r.currency });
    byCompany.set(r.companyId, list);
  }
  return byCompany;
}

/** First snapshot at least `minT`, but not absurdly later (2x horizon). */
function findOutcome(points: Snapshot[], fromIndex: number, minT: number, maxT: number): Snapshot | null {
  for (let i = fromIndex + 1; i < points.length; i++) {
    const p = points[i]!;
    if (p.t >= minT) return p.t <= maxT ? p : null;
  }
  return null;
}

function methodStats(byCompany: Map<number, Snapshot[]>, method: "dcf" | "graham", horizon: number): MethodHorizonStats {
  let calls = 0;
  let hits = 0;
  let toward = 0;
  const underReturns: number[] = [];
  const overReturns: number[] = [];
  const companies = new Set<number>();

  for (const [companyId, points] of byCompany) {
    points.forEach((s, i) => {
      const value = method === "dcf" ? s.dcf : s.graham;
      if (value == null || !(value > 0)) return;
      const outcome = findOutcome(points, i, s.t + horizon * DAY_MS, s.t + 2 * horizon * DAY_MS);
      if (!outcome) return;

      const r = (outcome.price / s.price - 1) * 100;
      const undervalued = value > s.price;
      calls++;
      companies.add(companyId);
      if (undervalued ? r > 0 : r < 0) hits++;
      if (Math.abs(value - outcome.price) < Math.abs(value - s.price)) toward++;
      (undervalued ? underReturns : overReturns).push(r);
    });
  }

  return {
    method,
    horizon_days: horizon,
    calls,
    hits,
    hit_rate: calls ? (hits / calls) * 100 : null,
    avg_return_when_undervalued: mean(underReturns),
    avg_return_when_overvalued: mean(overReturns),
    toward_value_rate: calls ? (toward / calls) * 100 : null,
    companies: companies.size,
  };
}

function nearest(points: Snapshot[], t: number, maxDistance: number): Snapshot | null {
  let best: Snapshot | null = null;
  for (const p of points) {
    const d = Math.abs(p.t - t);
    if (d <= maxDistance && (!best || d < Math.abs(best.t - t))) best = p;
  }
  return best;
}

async function computeLeaderboard(byCompany: Map<number, Snapshot[]>) {
  const [companies, analyses, users] = await Promise.all([
    db.select({ id: watchlistCompaniesTable.id, ticker: watchlistCompaniesTable.ticker }).from(watchlistCompaniesTable),
    db
      .select({
        id: analysesTable.id,
        userId: analysesTable.userId,
        ticker: analysesTable.ticker,
        createdAt: analysesTable.createdAt,
        marginOfSafety: analysesTable.marginOfSafety,
      })
      .from(analysesTable)
      .where(isNotNull(analysesTable.userId))
      .orderBy(asc(analysesTable.createdAt)),
    db.select({ id: usersTable.id, displayName: usersTable.displayName }).from(usersTable),
  ]);

  const companyByTicker = new Map(companies.map((c) => [c.ticker.toUpperCase(), c.id]));
  const userById = new Map(users.map((u) => [u.id, u]));
  const now = Date.now();

  const callsByUser = new Map<number, UserCall[]>();
  const pendingByUser = new Map<number, number>();
  const lastCounted = new Map<string, number>(); // `${user}:${ticker}` -> t

  for (const a of analyses) {
    const userId = a.userId!;
    const t = a.createdAt.getTime();

    if (now - t < MIN_CALL_AGE_DAYS * DAY_MS) {
      pendingByUser.set(userId, (pendingByUser.get(userId) ?? 0) + 1);
      continue;
    }

    // One call per user, ticker and week: re-publishing the same idea
    // doesn't multiply its weight.
    const key = `${userId}:${a.ticker}`;
    const prev = lastCounted.get(key);
    if (prev != null && t - prev < 7 * DAY_MS) continue;

    const companyId = companyByTicker.get(a.ticker.toUpperCase());
    const points = companyId != null ? byCompany.get(companyId) : undefined;
    if (!points || points.length === 0) continue;

    const start = nearest(points, t, 10 * DAY_MS);
    const latest = points[points.length - 1]!;
    if (!start || latest.t - t < MIN_CALL_AGE_DAYS * DAY_MS) continue;

    lastCounted.set(key, t);
    const bullish = a.marginOfSafety > 0;
    const r = (latest.price / start.price - 1) * 100;
    const list = callsByUser.get(userId) ?? [];
    list.push({
      analysis_id: a.id,
      ticker: a.ticker,
      published_at: a.createdAt.toISOString(),
      bullish,
      price_then: start.price,
      price_now: latest.price,
      currency: latest.currency,
      return_pct: r,
      hit: bullish ? r > 0 : r < 0,
    });
    callsByUser.set(userId, list);
  }

  const userIds = new Set<number>([...callsByUser.keys(), ...pendingByUser.keys()]);
  const leaderboard: LeaderboardEntry[] = [];
  for (const userId of userIds) {
    const user = userById.get(userId);
    if (!user) continue;
    const calls = callsByUser.get(userId) ?? [];
    const hits = calls.filter((c) => c.hit).length;
    leaderboard.push({
      user_id: userId,
      name: publicName(user),
      evaluated: calls.length,
      hits,
      hit_rate: calls.length ? (hits / calls.length) * 100 : 0,
      avg_call_return: mean(calls.map((c) => (c.bullish ? c.return_pct : -c.return_pct))) ?? 0,
      pending: pendingByUser.get(userId) ?? 0,
      ranked: calls.length >= MIN_CALLS_FOR_RANKING,
    });
  }

  leaderboard.sort((a, b) => {
    if (a.ranked !== b.ranked) return a.ranked ? -1 : 1;
    if (b.hit_rate !== a.hit_rate) return b.hit_rate - a.hit_rate;
    if (b.avg_call_return !== a.avg_call_return) return b.avg_call_return - a.avg_call_return;
    return b.evaluated + b.pending - (a.evaluated + a.pending);
  });

  return { leaderboard, callsByUser };
}

let cache: { value: TrackRecord; expiresAt: number } | null = null;

/** Computes (or returns the cached, at most 10 minutes old) track record. */
export async function getTrackRecord(): Promise<TrackRecord> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  const byCompany = await loadSnapshots();
  let first: number | null = null;
  let snapshots = 0;
  for (const points of byCompany.values()) {
    snapshots += points.length;
    if (points[0] && (first == null || points[0].t < first)) first = points[0].t;
  }

  const methods: MethodHorizonStats[] = [];
  for (const horizon of HORIZONS) {
    methods.push(methodStats(byCompany, "dcf", horizon));
    methods.push(methodStats(byCompany, "graham", horizon));
  }

  const { leaderboard, callsByUser } = await computeLeaderboard(byCompany);

  const value: TrackRecord = {
    generated_at: new Date().toISOString(),
    tracking_since: first != null ? new Date(first).toISOString() : null,
    snapshots,
    companies_tracked: byCompany.size,
    methods,
    leaderboard,
    calls_by_user: callsByUser,
  };
  cache = { value, expiresAt: Date.now() + 10 * 60 * 1000 };
  return value;
}
