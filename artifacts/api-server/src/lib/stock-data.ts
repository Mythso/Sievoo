import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  watchlistCompaniesTable,
  watchlistValuationsTable,
  type WatchlistCompany,
  type WatchlistValuation,
} from "@workspace/db";

/**
 * Read helpers shared by the public stock pages, SEO rendering, share
 * images, the track record and alerts. Everything is derived from the
 * watchlist tables (companies + append-only valuation snapshots).
 */

export interface StockSummary {
  id: number;
  ticker: string;
  company_name: string | null;
  source: string;
  market: "oslo" | "us" | "other";
  currency: string | null;
  price: number | null;
  base_dcf: number | null;
  bear_dcf: number | null;
  bull_dcf: number | null;
  margin_of_safety: number | null;
  graham_number: number | null;
  graham_margin_of_safety: number | null;
  insider_score: number | null;
  computed_at: string | null;
  runs: number;
  first_run_at: string | null;
}

export function marketOf(ticker: string): StockSummary["market"] {
  if (ticker.endsWith(".OL")) return "oslo";
  if (/^[A-Z][A-Z0-9-]{0,5}$/.test(ticker)) return "us";
  return "other";
}

/** Latest *successful* valuation per company (failed runs are skipped). */
export async function getLatestOkValuations(): Promise<Map<number, WatchlistValuation>> {
  const rows = await db
    .selectDistinctOn([watchlistValuationsTable.companyId])
    .from(watchlistValuationsTable)
    .where(eq(watchlistValuationsTable.status, "ok"))
    .orderBy(watchlistValuationsTable.companyId, desc(watchlistValuationsTable.computedAt));
  return new Map(rows.map((r) => [r.companyId, r]));
}

async function getRunStats(): Promise<Map<number, { runs: number; first: Date | null }>> {
  const rows = await db
    .select({
      companyId: watchlistValuationsTable.companyId,
      runs: sql<number>`count(*)::int`,
      first: sql<Date | null>`min(${watchlistValuationsTable.computedAt})`,
    })
    .from(watchlistValuationsTable)
    .where(eq(watchlistValuationsTable.status, "ok"))
    .groupBy(watchlistValuationsTable.companyId);
  return new Map(rows.map((r) => [r.companyId, { runs: r.runs, first: r.first ? new Date(r.first) : null }]));
}

export function toStockSummary(
  company: WatchlistCompany,
  latest: WatchlistValuation | undefined,
  stats?: { runs: number; first: Date | null },
): StockSummary {
  return {
    id: company.id,
    ticker: company.ticker,
    company_name: company.companyName,
    source: company.source,
    market: marketOf(company.ticker),
    currency: latest?.currency ?? (company.ticker.endsWith(".OL") ? "NOK" : null),
    price: latest?.price ?? null,
    base_dcf: latest?.baseDcf ?? null,
    bear_dcf: latest?.bearDcf ?? null,
    bull_dcf: latest?.bullDcf ?? null,
    margin_of_safety: latest?.marginOfSafety ?? null,
    graham_number: latest?.grahamNumber ?? null,
    graham_margin_of_safety: latest?.grahamMarginOfSafety ?? null,
    insider_score: latest?.insiderScore ?? null,
    computed_at: latest?.computedAt.toISOString() ?? null,
    runs: stats?.runs ?? 0,
    first_run_at: stats?.first?.toISOString() ?? null,
  };
}

/** Every tracked company with its latest numbers, sorted by ticker. */
export async function listStocks(): Promise<StockSummary[]> {
  const [companies, latest, stats] = await Promise.all([
    db.select().from(watchlistCompaniesTable).orderBy(watchlistCompaniesTable.ticker),
    getLatestOkValuations(),
    getRunStats(),
  ]);
  return companies.map((c) => toStockSummary(c, latest.get(c.id), stats.get(c.id)));
}

export async function getCompanyByTicker(ticker: string): Promise<WatchlistCompany | null> {
  const [company] = await db
    .select()
    .from(watchlistCompaniesTable)
    .where(eq(watchlistCompaniesTable.ticker, ticker.toUpperCase()));
  return company ?? null;
}

export async function getLatestOkValuation(companyId: number): Promise<WatchlistValuation | null> {
  const [row] = await db
    .select()
    .from(watchlistValuationsTable)
    .where(and(eq(watchlistValuationsTable.companyId, companyId), eq(watchlistValuationsTable.status, "ok")))
    .orderBy(desc(watchlistValuationsTable.computedAt))
    .limit(1);
  return row ?? null;
}

export interface HistoryPoint {
  computed_at: string;
  price: number | null;
  bear_dcf: number | null;
  base_dcf: number | null;
  bull_dcf: number | null;
  margin_of_safety: number | null;
  graham_number: number | null;
  graham_margin_of_safety: number | null;
}

const MAX_HISTORY_POINTS = 500;

/** Successful runs for one company, oldest first, capped. */
export async function getHistoryPoints(companyId: number): Promise<HistoryPoint[]> {
  const rows = await db
    .select()
    .from(watchlistValuationsTable)
    .where(and(eq(watchlistValuationsTable.companyId, companyId), eq(watchlistValuationsTable.status, "ok")))
    .orderBy(watchlistValuationsTable.computedAt);
  return rows.slice(-MAX_HISTORY_POINTS).map((r) => ({
    computed_at: r.computedAt.toISOString(),
    price: r.price,
    bear_dcf: r.bearDcf,
    base_dcf: r.baseDcf,
    bull_dcf: r.bullDcf,
    margin_of_safety: r.marginOfSafety,
    graham_number: r.grahamNumber,
    graham_margin_of_safety: r.grahamMarginOfSafety,
  }));
}
