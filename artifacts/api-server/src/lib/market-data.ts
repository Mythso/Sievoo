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
