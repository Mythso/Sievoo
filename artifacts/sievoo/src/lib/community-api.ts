import { useQuery } from '@tanstack/react-query';
import type { Analysis } from '@workspace/api-client-react';
import { apiFetch } from './auth';

/** Types + query hooks for the community endpoints (stocks, profiles, alerts, track record). */

export interface StockSummary {
  id: number;
  ticker: string;
  company_name: string | null;
  source: string;
  market: 'oslo' | 'us' | 'other';
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

export interface FollowSettings {
  method: 'dcf' | 'graham';
  min_margin_of_safety: number;
  email_enabled: boolean;
}

export interface StockDetail {
  stock: StockSummary;
  notes: string | null;
  published_analysis_id: number | null;
  insider_transactions: { filer: string | null; relation: string | null; transactionText: string | null; value: number | null; date: string | null }[];
  history: HistoryPoint[];
  analyses: Analysis[];
  followers: number;
  my_follow: FollowSettings | null;
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

export interface Profile {
  id: number;
  name: string;
  created_at: string;
  analyses_count: number;
  total_likes: number;
  comments_count: number;
  track: {
    evaluated: number;
    hits: number;
    hit_rate: number;
    avg_call_return: number;
    pending: number;
    rank: number | null;
    min_calls_for_ranking: number;
  } | null;
  calls: UserCall[];
}

export interface MethodStats {
  method: 'dcf' | 'graham';
  horizon_days: number;
  calls: number;
  hits: number;
  hit_rate: number | null;
  avg_return_when_undervalued: number | null;
  avg_return_when_overvalued: number | null;
  toward_value_rate: number | null;
  companies: number;
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
  horizons: number[];
  min_call_age_days: number;
  min_calls_for_ranking: number;
  methods: MethodStats[];
  leaderboard: LeaderboardEntry[];
}

export interface FollowItem extends FollowSettings {
  ticker: string;
  company_name: string | null;
  last_triggered_at: string | null;
  currency: string | null;
  price: number | null;
  base_dcf: number | null;
  graham_number: number | null;
  margin_of_safety: number | null;
  graham_margin_of_safety: number | null;
}

export interface FollowList {
  items: FollowItem[];
  email_configured: boolean;
  weekly_digest: boolean;
}

export const useStocks = () =>
  useQuery({ queryKey: ['/api/stocks'], queryFn: () => apiFetch<{ items: StockSummary[] }>('/api/stocks') });

export const stockQueryKey = (ticker: string) => ['/api/stocks', ticker.toUpperCase()];
export const useStock = (ticker: string) =>
  useQuery({
    queryKey: stockQueryKey(ticker),
    queryFn: () => apiFetch<StockDetail>(`/api/stocks/${encodeURIComponent(ticker.toUpperCase())}`),
    retry: false,
  });

export const useProfile = (id: number) =>
  useQuery({ queryKey: ['/api/users', id], queryFn: () => apiFetch<Profile>(`/api/users/${id}`), retry: false });

export const useTrackRecord = () =>
  useQuery({ queryKey: ['/api/track-record'], queryFn: () => apiFetch<TrackRecord>('/api/track-record') });

export const FOLLOWS_QUERY_KEY = ['/api/follows'];
export const useFollows = (enabled: boolean) =>
  useQuery({ queryKey: FOLLOWS_QUERY_KEY, queryFn: () => apiFetch<FollowList>('/api/follows'), enabled });
