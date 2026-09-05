/**
 * Free, unofficial Yahoo Finance data fetcher.
 * No API key required. Yahoo requires a session cookie + "crumb" token
 * for the quoteSummary endpoint, so we fetch and cache those first.
 * This is unofficial and can break if Yahoo changes their API.
 */

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

let cachedCookie: string | null = null;
let cachedCrumb: string | null = null;
let cacheExpiresAt = 0;

async function getCookieAndCrumb(
  forceRefresh = false,
): Promise<{ cookie: string; crumb: string }> {
  if (
    !forceRefresh &&
    cachedCookie &&
    cachedCrumb &&
    Date.now() < cacheExpiresAt
  ) {
    return { cookie: cachedCookie, crumb: cachedCrumb };
  }

  const cookieRes = await fetch("https://fc.yahoo.com", {
    headers: { "User-Agent": USER_AGENT },
  });
  const setCookie = cookieRes.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0] ?? "";

  const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
    headers: { "User-Agent": USER_AGENT, Cookie: cookie },
  });
  if (!crumbRes.ok) {
    throw new Error(`Failed to fetch Yahoo Finance crumb: ${crumbRes.status}`);
  }
  const crumb = (await crumbRes.text()).trim();
  if (!crumb) {
    throw new Error("Yahoo Finance returned an empty crumb");
  }

  cachedCookie = cookie;
  cachedCrumb = crumb;
  cacheExpiresAt = Date.now() + 30 * 60 * 1000; // reuse for 30 min

  return { cookie, crumb };
}

/**
 * Fetches a Yahoo Finance quoteSummary payload for the given ticker/modules,
 * retrying once with a freshly-fetched cookie/crumb if the first attempt
 * fails. Yahoo occasionally rejects requests mid-session (stale/invalidated
 * crumb, or a transient block) even though the cached cookie/crumb pair is
 * still within its 30-minute window - a single retry with a forced-fresh
 * cookie/crumb recovers from this without failing the whole run.
 */
async function fetchYahooQuoteSummary(
  ticker: string,
  modules: string,
): Promise<any> {
  let lastErr: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { cookie, crumb } = await getCookieAndCrumb(attempt > 0);

      const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
        ticker,
      )}?modules=${modules}&crumb=${encodeURIComponent(crumb)}`;

      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Cookie: cookie },
      });

      if (!res.ok) {
        throw new Error(`Yahoo Finance request failed for ${ticker}: ${res.status}`);
      }

      const json = (await res.json()) as any;
      const result = json?.quoteSummary?.result?.[0];
      if (!result) {
        const errDesc = json?.quoteSummary?.error?.description;
        throw new Error(errDesc || `No data returned from Yahoo Finance for ${ticker}`);
      }

      return result;
    } catch (err) {
      lastErr = err;
      // Force a fresh cookie/crumb on the next attempt, since a stale or
      // invalidated crumb is the most common cause of a mid-session failure.
      cachedCookie = null;
      cachedCrumb = null;
      cacheExpiresAt = 0;
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error(`Yahoo Finance request failed for ${ticker}`);
}

export interface MarketData {
  ticker: string;
  price: number;
  shares: number;
  beta: number;
  cash: number;
  debtTotal: number;
  revenue: number;
  revGrowth: number;
  fcfMargin: number;
  // AutoValue (Graham Number) inputs - not guaranteed for every ticker
  // (e.g. unprofitable companies have no meaningful trailing EPS), so these
  // are nullable rather than required like the DCF inputs above.
  eps: number | null;
  bookValuePerShare: number | null;
}

export async function fetchMarketData(ticker: string): Promise<MarketData> {
  const modules = "defaultKeyStatistics,financialData";
  const result = await fetchYahooQuoteSummary(ticker, modules);

  const stats = result.defaultKeyStatistics ?? {};
  const fin = result.financialData ?? {};

  const price: number | undefined = fin.currentPrice?.raw;
  const shares: number | undefined = stats.sharesOutstanding?.raw;
  const beta: number = stats.beta?.raw ?? 1.0;
  const cash: number = fin.totalCash?.raw ?? 0;
  const debtTotal: number = fin.totalDebt?.raw ?? 0;
  const revenue: number | undefined = fin.totalRevenue?.raw;
  const revGrowth: number = (fin.revenueGrowth?.raw ?? 0) * 100;
  const freeCashflow: number | undefined = fin.freeCashflow?.raw;
  const operatingMargin: number = (fin.operatingMargins?.raw ?? 0) * 100;
  const fcfMargin: number =
    revenue && freeCashflow ? (freeCashflow / revenue) * 100 : operatingMargin;
  const eps: number | null = stats.trailingEps?.raw ?? null;
  const bookValuePerShare: number | null = stats.bookValue?.raw ?? null;

  if (!price || !shares || !revenue) {
    throw new Error(`Incomplete data returned from Yahoo Finance for ${ticker}`);
  }

  return {
    ticker,
    price,
    shares,
    beta,
    cash,
    debtTotal,
    revenue,
    revGrowth,
    fcfMargin,
    eps,
    bookValuePerShare,
  };
}

// ---------------------------------------------------------------------------
// Insider trading data (meldepliktig handel)
// ---------------------------------------------------------------------------

export interface InsiderTransaction {
  filer: string | null;
  relation: string | null;
  transactionText: string | null;
  shares: number | null;
  value: number | null;
  date: string | null; // ISO date, if available
}

export interface InsiderData {
  score: number; // 0-100, 50 = neutral, computed from net insider buying/selling
  netPercentInsiderShares: number | null; // e.g. 0.023 = insiders' holdings grew 2.3% over the period
  buyCount: number;
  sellCount: number;
  transactions: InsiderTransaction[]; // most recent first, capped
}

function parseTransactions(raw: any[] | undefined): InsiderTransaction[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 10).map((t) => ({
    filer: t.filerName ?? null,
    relation: t.filerRelation ?? null,
    transactionText: t.transactionText ?? null,
    shares: t.shares?.raw ?? null,
    value: t.value?.raw ?? null,
    date: t.startDate?.fmt ?? null,
  }));
}

function computeInsiderScore(
  activity: any | undefined,
  transactions: InsiderTransaction[],
): { score: number; buyCount: number; sellCount: number } {
  let score = 50;
  let buyCount = 0;
  let sellCount = 0;

  if (activity) {
    buyCount = activity.buyInfoCount?.raw ?? 0;
    sellCount = activity.sellInfoCount?.raw ?? 0;
    const netPct: number = activity.netPercentInsiderShares?.raw ?? 0;

    // Net change in insider ownership over the period is the strongest signal.
    score += netPct * 400;

    const totalCount = buyCount + sellCount;
    if (totalCount > 0) {
      const buyRatio = buyCount / totalCount;
      score += (buyRatio - 0.5) * 40;
    }
  } else if (transactions.length > 0) {
    buyCount = transactions.filter((t) =>
      /purchase|buy|kj\u00f8p/i.test(t.transactionText ?? ""),
    ).length;
    sellCount = transactions.filter((t) =>
      /sale|sell|salg/i.test(t.transactionText ?? ""),
    ).length;
    const total = buyCount + sellCount;
    if (total > 0) {
      score += (buyCount / total - 0.5) * 60;
    }
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), buyCount, sellCount };
}

/**
 * Fetches recent insider (Form 4 / meldepliktig handel-equivalent) activity
 * from Yahoo Finance and derives a 0-100 "insider score" (50 = neutral,
 * higher = net insider buying). Uses the same cookie/crumb session as
 * fetchMarketData. Returns a neutral score if Yahoo has no insider data
 * for the ticker (common for smaller / non-US listings).
 */
export async function fetchInsiderData(ticker: string): Promise<InsiderData> {
  const modules = "insiderTransactions,netSharePurchaseActivity";

  let result: any;
  try {
    result = await fetchYahooQuoteSummary(ticker, modules);
  } catch {
    // No insider module coverage for this ticker; treat as neutral rather than failing the whole run.
    return { score: 50, netPercentInsiderShares: null, buyCount: 0, sellCount: 0, transactions: [] };
  }

  const activity = result.netSharePurchaseActivity;
  const transactions = parseTransactions(result.insiderTransactions?.transactions);
  const { score, buyCount, sellCount } = computeInsiderScore(activity, transactions);

  return {
    score,
    netPercentInsiderShares: activity?.netPercentInsiderShares?.raw ?? null,
    buyCount,
    sellCount,
    transactions,
  };
}

// ---------------------------------------------------------------------------
// Ticker -> company name lookup (used for auto-filling company name fields)
// ---------------------------------------------------------------------------

export interface TickerLookupResult {
  ticker: string;
  companyName: string | null;
}

/**
 * Looks up a ticker's display name via Yahoo Finance's "price" module.
 * Returns companyName: null (not an error) if the ticker isn't found or
 * has no name on file, so callers can fall back gracefully.
 */
export async function lookupTicker(ticker: string): Promise<TickerLookupResult> {
  const result = await fetchYahooQuoteSummary(ticker, "price");
  const price = result.price;
  const companyName: string | null = price?.longName ?? price?.shortName ?? null;

  return { ticker: ticker.toUpperCase(), companyName };
}

// ---------------------------------------------------------------------------
// Trending tickers (daily auto-discovery for the trending-worker)
// ---------------------------------------------------------------------------

/**
 * Fetches today's trending US tickers from Yahoo Finance's public
 * "trending securities" endpoint. This is a lighter, unauthenticated
 * endpoint that doesn't need the cookie/crumb dance used above.
 * Only plain equity-style symbols are kept (crypto pairs like "BTC-USD"
 * and indices like "^GSPC" are filtered out, since the DCF model doesn't
 * apply to them).
 */
export async function fetchTrendingTickers(
  region = "US",
  count = 15,
): Promise<string[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/trending/${encodeURIComponent(
    region,
  )}?count=${count}`;

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance trending request failed: ${res.status}`);
  }

  const json = (await res.json()) as any;
  const quotes = json?.finance?.result?.[0]?.quotes ?? [];

  return quotes
    .map((q: any) => q?.symbol)
    .filter(
      (s: unknown): s is string =>
        typeof s === "string" && /^[A-Z]{1,6}$/.test(s),
    );
}
