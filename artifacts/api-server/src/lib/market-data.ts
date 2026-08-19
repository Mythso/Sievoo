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

async function getCookieAndCrumb(): Promise<{ cookie: string; crumb: string }> {
  if (cachedCookie && cachedCrumb && Date.now() < cacheExpiresAt) {
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
}

export async function fetchMarketData(ticker: string): Promise<MarketData> {
  const { cookie, crumb } = await getCookieAndCrumb();

  const modules = "defaultKeyStatistics,financialData";
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

  if (!price || !shares || !revenue) {
    throw new Error(`Incomplete data returned from Yahoo Finance for ${ticker}`);
  }

  return { ticker, price, shares, beta, cash, debtTotal, revenue, revGrowth, fcfMargin };
}
\n

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
  const { cookie, crumb } = await getCookieAndCrumb();

  const modules = "insiderTransactions,netSharePurchaseActivity";
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
    ticker,
  )}?modules=${modules}&crumb=${encodeURIComponent(crumb)}`;

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Cookie: cookie },
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance insider request failed for ${ticker}: ${res.status}`);
  }

  const json = (await res.json()) as any;
  const result = json?.quoteSummary?.result?.[0];
  if (!result) {
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
