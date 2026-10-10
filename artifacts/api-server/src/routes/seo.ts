import { Router, type IRouter } from "express";
import { desc, eq, isNotNull, sql } from "drizzle-orm";
import { db, analysesTable, commentsTable, usersTable } from "@workspace/db";
import { listStocks, getCompanyByTicker, getLatestOkValuation, getHistoryPoints, marketOf, type StockSummary } from "../lib/stock-data";
import { getTrackRecord } from "../lib/track-record";
import { formatMoney, formatPercent } from "../lib/format";
import { escapeHtml as esc, siteUrl } from "../lib/mailer";
import { loadProfile } from "./users";

/**
 * Server-side SEO for the dynamic pages. The frontend is a client-rendered
 * SPA, so crawlers that don't run JavaScript (and every link-preview bot)
 * would otherwise only ever see the generic homepage tags. The web
 * service's preview server (artifacts/sievoo/vite-plugin-seo.ts) asks this
 * endpoint for the title/description/image and a plain-HTML version of the
 * page's content, and injects them into index.html before sending it.
 * React replaces the injected content as soon as the app boots.
 */

const router: IRouter = Router();

export interface SeoPage {
  status: number;
  title: string;
  description: string;
  canonical: string;
  image: string;
  noindex?: boolean;
  html: string;
}

function truncate(text: string, max = 158): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`;
}

const notFound = (path: string): SeoPage => ({
  status: 404,
  title: "Page not found | Sievoo",
  description: "This page doesn't exist on Sievoo.",
  canonical: `${siteUrl()}${path}`,
  image: `${siteUrl()}/og-image.png`,
  noindex: true,
  html: `<main><h1>Page not found</h1><p><a href="/stocks">Browse stock valuations</a></p></main>`,
});

function stockRow(s: StockSummary): string {
  return `<li><a href="/stock/${encodeURIComponent(s.ticker)}">${esc(s.ticker)}${s.company_name ? ` – ${esc(s.company_name)}` : ""}</a>: price ${esc(formatMoney(s.price, s.currency))}, DCF ${esc(formatMoney(s.base_dcf, s.currency))}, Graham Number ${esc(formatMoney(s.graham_number, s.currency))}, margin of safety ${esc(formatPercent(s.margin_of_safety))}</li>`;
}

async function renderStocks(): Promise<SeoPage> {
  const stocks = (await listStocks()).filter((s) => s.price != null);
  const oslo = stocks.filter((s) => s.market === "oslo");
  const other = stocks.filter((s) => s.market !== "oslo");
  return {
    status: 200,
    title: `Stock Valuations: DCF & Graham Number for ${stocks.length} Stocks | Sievoo`,
    description: truncate(
      `Intrinsic value estimates for ${stocks.length} US and Oslo Børs stocks: discounted cash flow, Graham Number and margin of safety, re-calculated automatically every week.`,
    ),
    canonical: `${siteUrl()}/stocks`,
    image: `${siteUrl()}/api/og/page/stocks.png`,
    html: `<main><h1>Stock valuations</h1><p>Automated DCF and Graham Number valuations, updated weekly. Free and transparent: every number comes from a published formula.</p>
${oslo.length ? `<h2>Oslo Børs</h2><ul>${oslo.map(stockRow).join("")}</ul>` : ""}
<h2>US and other markets</h2><ul>${other.map(stockRow).join("")}</ul></main>`,
  };
}

async function renderStock(rawTicker: string): Promise<SeoPage> {
  const ticker = rawTicker.toUpperCase();
  const company = await getCompanyByTicker(ticker);
  if (!company) return notFound(`/stock/${rawTicker}`);

  const [v, history, analyses, related] = await Promise.all([
    getLatestOkValuation(company.id),
    getHistoryPoints(company.id),
    db.select().from(analysesTable).where(eq(analysesTable.ticker, ticker)).orderBy(desc(analysesTable.createdAt)).limit(10),
    listStocks(),
  ]);

  const name = company.companyName ?? ticker;
  const cur = v?.currency ?? null;
  const updated = v ? v.computedAt.toISOString().slice(0, 10) : null;
  const title = v
    ? `${ticker} Intrinsic Value: DCF ${formatMoney(v.baseDcf, cur)} vs Price ${formatMoney(v.price, cur)} | Sievoo`
    : `${ticker} Intrinsic Value – DCF & Graham Number | Sievoo`;
  const description = v
    ? truncate(
        `${name} (${ticker}) fair value: base-case DCF ${formatMoney(v.baseDcf, cur)}, Graham Number ${formatMoney(v.grahamNumber, cur)}, margin of safety ${formatPercent(v.marginOfSafety)} at ${formatMoney(v.price, cur)}. Updated ${updated}.`,
      )
    : truncate(`${name} (${ticker}) intrinsic value estimate with an automated DCF and the Graham Number, updated weekly on Sievoo.`);

  const sameMarket = related
    .filter((s) => s.ticker !== ticker && s.market === marketOf(ticker) && s.price != null)
    .slice(0, 12);

  const html = `<main><h1>${esc(name)} (${esc(ticker)}) intrinsic value</h1>
${
  v
    ? `<p>Price ${esc(formatMoney(v.price, cur))} on ${esc(updated ?? "")}.</p>
<table><tr><th>Method</th><th>Value</th><th>Margin of safety</th></tr>
<tr><td>DCF – bear case</td><td>${esc(formatMoney(v.bearDcf, cur))}</td><td></td></tr>
<tr><td>DCF – base case</td><td>${esc(formatMoney(v.baseDcf, cur))}</td><td>${esc(formatPercent(v.marginOfSafety))}</td></tr>
<tr><td>DCF – bull case</td><td>${esc(formatMoney(v.bullDcf, cur))}</td><td></td></tr>
<tr><td>Graham Number</td><td>${esc(formatMoney(v.grahamNumber, cur))}</td><td>${esc(formatPercent(v.grahamMarginOfSafety))}</td></tr></table>
<p>WACC ${v.wacc != null ? esc(v.wacc.toFixed(1)) : "—"}%, revenue growth ${v.revGrowth != null ? esc(v.revGrowth.toFixed(1)) : "—"}%, FCF margin ${v.fcfMargin != null ? esc(v.fcfMargin.toFixed(1)) : "—"}%, EPS ${esc(formatMoney(v.eps, cur))}, book value per share ${esc(formatMoney(v.bookValuePerShare, cur))}. ${history.length} valuation runs recorded.</p>`
    : `<p>The first valuation run for ${esc(ticker)} hasn't completed yet.</p>`
}
${analyses.length ? `<h2>Community analyses of ${esc(ticker)}</h2><ul>${analyses.map((a) => `<li><a href="/analysis/${a.id}">${esc(a.title)}</a> by ${esc(a.authorAlias)} – base ${esc(formatMoney(a.baseDcf, a.currency))}, margin of safety ${esc(formatPercent(a.marginOfSafety))}</li>`).join("")}</ul>` : ""}
${sameMarket.length ? `<h2>More valuations</h2><ul>${sameMarket.map(stockRow).join("")}</ul>` : ""}
<p><a href="/calculator">Run your own DCF</a> · <a href="/track-record">How accurate are these valuations?</a></p></main>`;

  return {
    status: 200,
    title,
    description,
    canonical: `${siteUrl()}/stock/${encodeURIComponent(ticker)}`,
    image: `${siteUrl()}/api/og/stock/${encodeURIComponent(ticker)}.png`,
    html,
  };
}

async function renderAnalysis(id: number): Promise<SeoPage> {
  const [a] = await db.select().from(analysesTable).where(eq(analysesTable.id, id));
  if (!a) return notFound(`/analysis/${id}`);
  const comments = await db
    .select()
    .from(commentsTable)
    .where(eq(commentsTable.analysisId, id))
    .orderBy(commentsTable.createdAt)
    .limit(50);

  const cur = a.currency;
  return {
    status: 200,
    title: truncate(`${a.title} – ${a.ticker} DCF by ${a.authorAlias} | Sievoo`, 90),
    description: truncate(
      `${a.ticker} valuation by ${a.authorAlias}: bear ${formatMoney(a.bearDcf, cur)}, base ${formatMoney(a.baseDcf, cur)}, bull ${formatMoney(a.bullDcf, cur)} vs price ${formatMoney(a.currentPrice, cur)} (margin of safety ${formatPercent(a.marginOfSafety)}).`,
    ),
    canonical: `${siteUrl()}/analysis/${a.id}`,
    image: `${siteUrl()}/api/og/analysis/${a.id}.png`,
    html: `<main><h1>${esc(a.title)}</h1><p>${esc(a.ticker)} · by ${a.userId ? `<a href="/u/${a.userId}">${esc(a.authorAlias)}</a>` : esc(a.authorAlias)} · ${esc(a.createdAt.toISOString().slice(0, 10))}</p>
<p>Price ${esc(formatMoney(a.currentPrice, cur))}. DCF bear ${esc(formatMoney(a.bearDcf, cur))}, base ${esc(formatMoney(a.baseDcf, cur))}, bull ${esc(formatMoney(a.bullDcf, cur))}. Margin of safety ${esc(formatPercent(a.marginOfSafety))}.</p>
${a.userNotes ? `<p>${esc(a.userNotes)}</p>` : ""}
${comments.length ? `<h2>Discussion</h2><ul>${comments.map((c) => `<li><strong>${esc(c.authorName)}</strong>: ${esc(c.commentText)}</li>`).join("")}</ul>` : ""}
<p><a href="/stock/${encodeURIComponent(a.ticker)}">All ${esc(a.ticker)} valuations</a></p></main>`,
  };
}

async function renderProfile(id: number): Promise<SeoPage> {
  const p = await loadProfile(id);
  if (!p) return notFound(`/u/${id}`);
  const analyses = await db
    .select()
    .from(analysesTable)
    .where(eq(analysesTable.userId, id))
    .orderBy(desc(analysesTable.createdAt))
    .limit(30);
  const record = p.track && p.track.evaluated > 0 ? ` Hit rate ${p.track.hit_rate.toFixed(0)}% on ${p.track.evaluated} scored calls.` : "";
  return {
    status: 200,
    title: `${p.name} – Value Investor Profile | Sievoo`,
    description: truncate(`${p.name} has published ${p.analyses_count} stock valuation${p.analyses_count === 1 ? "" : "s"} on Sievoo.${record}`),
    canonical: `${siteUrl()}/u/${id}`,
    image: `${siteUrl()}/api/og/user/${id}.png`,
    noindex: p.analyses_count === 0,
    html: `<main><h1>${esc(p.name)}</h1><p>${p.analyses_count} published analyses.${esc(record)}</p>
<ul>${analyses.map((a) => `<li><a href="/analysis/${a.id}">${esc(a.title)}</a> (${esc(a.ticker)}, margin of safety ${esc(formatPercent(a.marginOfSafety))})</li>`).join("")}</ul></main>`,
  };
}

async function renderTrackRecord(): Promise<SeoPage> {
  const r = await getTrackRecord();
  const rows = r.methods
    .filter((m) => m.calls > 0)
    .map(
      (m) =>
        `<li>${m.method === "dcf" ? "AutoDCF" : "Graham Number"}, ${m.horizon_days} days: ${m.hit_rate?.toFixed(0)}% of ${m.calls} calls pointed the right way</li>`,
    )
    .join("");
  const ranked = r.leaderboard.filter((e) => e.ranked).slice(0, 20);
  return {
    status: 200,
    title: "Track Record: How Accurate Are DCF and Graham Valuations? | Sievoo",
    description: truncate(
      "Every Sievoo valuation is stored and checked against what the stock actually did 30, 90 and 365 days later - for the automated DCF, the Graham Number and every community analyst.",
    ),
    canonical: `${siteUrl()}/track-record`,
    image: `${siteUrl()}/api/og/page/track-record.png`,
    html: `<main><h1>Track record</h1><p>${r.snapshots} valuation snapshots across ${r.companies_tracked} companies${r.tracking_since ? ` since ${esc(r.tracking_since.slice(0, 10))}` : ""}.</p>
${rows ? `<h2>Valuation methods</h2><ul>${rows}</ul>` : "<p>Results appear once valuations are 30 days old.</p>"}
${ranked.length ? `<h2>Analyst leaderboard</h2><ol>${ranked.map((e) => `<li><a href="/u/${e.user_id}">${esc(e.name)}</a> – ${e.hit_rate.toFixed(0)}% hit rate on ${e.evaluated} calls</li>`).join("")}</ol>` : ""}</main>`,
  };
}

export async function renderSeoPage(path: string): Promise<SeoPage | null> {
  const clean = path.split("?")[0]!.replace(/\/+$/, "") || "/";
  let m: RegExpMatchArray | null;
  if (clean === "/stocks") return renderStocks();
  if (clean === "/track-record") return renderTrackRecord();
  if ((m = clean.match(/^\/stock\/([A-Za-z0-9.\-%]+)$/))) return renderStock(decodeURIComponent(m[1]!));
  if ((m = clean.match(/^\/analysis\/(\d+)$/))) return renderAnalysis(Number(m[1]));
  if ((m = clean.match(/^\/u\/(\d+)$/))) return renderProfile(Number(m[1]));
  return null;
}

router.get("/seo/render", async (req, res): Promise<void> => {
  const path = typeof req.query.path === "string" ? req.query.path : "";
  if (!path.startsWith("/") || path.length > 200) {
    res.status(400).json({ error: "Invalid path" });
    return;
  }
  const page = await renderSeoPage(path);
  if (!page) {
    res.status(204).end();
    return;
  }
  res.set("Cache-Control", "public, max-age=300");
  res.json(page);
});

// Dynamic sitemap entries (stocks, analyses, active profiles), merged by
// the web service into the build-time sitemap of static pages.
router.get("/seo/sitemap", async (_req, res): Promise<void> => {
  const [stocks, analyses, authors] = await Promise.all([
    listStocks(),
    db
      .select({ id: analysesTable.id, createdAt: analysesTable.createdAt })
      .from(analysesTable)
      .orderBy(desc(analysesTable.createdAt))
      .limit(5000),
    db
      .select({ id: usersTable.id, last: sql<Date>`max(${analysesTable.createdAt})` })
      .from(usersTable)
      .innerJoin(analysesTable, eq(analysesTable.userId, usersTable.id))
      .where(isNotNull(analysesTable.userId))
      .groupBy(usersTable.id),
  ]);

  const entries = [
    ...stocks
      .filter((s) => s.price != null)
      .map((s) => ({ path: `/stock/${encodeURIComponent(s.ticker)}`, lastmod: s.computed_at?.slice(0, 10) ?? null })),
    ...analyses.map((a) => ({ path: `/analysis/${a.id}`, lastmod: a.createdAt.toISOString().slice(0, 10) })),
    ...authors.map((u) => ({ path: `/u/${u.id}`, lastmod: new Date(u.last).toISOString().slice(0, 10) })),
  ];
  res.set("Cache-Control", "public, max-age=900");
  res.json({ entries });
});

export default router;
