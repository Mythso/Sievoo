import crypto from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, tickerFollowsTable, usersTable, watchlistCompaniesTable } from "@workspace/db";
import { getLatestOkValuations } from "./stock-data";
import { formatMoney, formatPercent } from "./format";
import { emailShell, escapeHtml, sendMail, siteUrl } from "./mailer";
import { logger } from "./logger";

export function newEmailToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

interface FollowedNumbers {
  ticker: string;
  companyName: string | null;
  currency: string | null;
  price: number | null;
  baseDcf: number | null;
  grahamNumber: number | null;
  dcfMos: number | null;
  grahamMos: number | null;
}

async function loadNumbersByTicker(tickers: string[]): Promise<Map<string, FollowedNumbers>> {
  if (tickers.length === 0) return new Map();
  const [companies, latest] = await Promise.all([
    db.select().from(watchlistCompaniesTable).where(inArray(watchlistCompaniesTable.ticker, tickers)),
    getLatestOkValuations(),
  ]);
  const out = new Map<string, FollowedNumbers>();
  for (const c of companies) {
    const v = latest.get(c.id);
    out.set(c.ticker, {
      ticker: c.ticker,
      companyName: c.companyName,
      currency: v?.currency ?? null,
      price: v?.price ?? null,
      baseDcf: v?.baseDcf ?? null,
      grahamNumber: v?.grahamNumber ?? null,
      dcfMos: v?.marginOfSafety ?? null,
      grahamMos: v?.grahamMarginOfSafety ?? null,
    });
  }
  return out;
}

function numbersRow(n: FollowedNumbers): string {
  const link = `${siteUrl()}/stock/${encodeURIComponent(n.ticker)}`;
  return `<tr>
<td style="padding:8px 0;border-bottom:1px solid #334155"><a href="${link}" style="color:#f59e0b;font-family:'Courier New',monospace;font-weight:bold;text-decoration:none">${escapeHtml(n.ticker)}</a><br><span style="font-size:12px;color:#94a3b8">${escapeHtml(n.companyName ?? "")}</span></td>
<td style="padding:8px 0;border-bottom:1px solid #334155;text-align:right;font-family:'Courier New',monospace;font-size:13px">Price ${escapeHtml(formatMoney(n.price, n.currency))}<br>DCF ${escapeHtml(formatMoney(n.baseDcf, n.currency))} (${escapeHtml(formatPercent(n.dcfMos))})<br>Graham ${escapeHtml(formatMoney(n.grahamNumber, n.currency))} (${escapeHtml(formatPercent(n.grahamMos))})</td>
</tr>`;
}

/**
 * Checks every ticker follow against the latest valuations and emails users
 * whose thresholds were crossed. An alert fires once when the margin of
 * safety rises to the threshold and re-arms only after it falls back below,
 * so a stock that stays cheap doesn't send an email every run.
 * Returns how many alerts fired.
 */
export async function runAlertCheck(): Promise<number> {
  const follows = await db.select().from(tickerFollowsTable);
  if (follows.length === 0) return 0;

  const numbers = await loadNumbersByTicker([...new Set(follows.map((f) => f.ticker))]);
  const firedByUser = new Map<number, { follow: typeof follows[number]; n: FollowedNumbers; mos: number }[]>();

  for (const follow of follows) {
    const n = numbers.get(follow.ticker);
    if (!n) continue;
    const mos = follow.method === "graham" ? n.grahamMos : n.dcfMos;
    if (mos == null) continue;

    if (mos >= follow.minMarginOfSafety) {
      if (!follow.armed) continue;
      await db
        .update(tickerFollowsTable)
        .set({ armed: 0, lastTriggeredAt: new Date() })
        .where(eq(tickerFollowsTable.id, follow.id));
      if (follow.emailEnabled) {
        const list = firedByUser.get(follow.userId) ?? [];
        list.push({ follow, n, mos });
        firedByUser.set(follow.userId, list);
      }
    } else if (!follow.armed) {
      await db.update(tickerFollowsTable).set({ armed: 1 }).where(eq(tickerFollowsTable.id, follow.id));
    }
  }

  let fired = 0;
  for (const [userId, items] of firedByUser) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) continue;
    fired += items.length;

    const tickers = items.map((i) => i.n.ticker).join(", ");
    const rows = items
      .map(
        (i) =>
          `${numbersRow(i.n)}<tr><td colspan="2" style="padding:4px 0 12px;font-size:12px;color:#10b981">${escapeHtml(
            `${i.follow.method === "graham" ? "Graham" : "DCF"} margin of safety ${formatPercent(i.mos)} ≥ your ${formatPercent(i.follow.minMarginOfSafety, 0)} alert`,
          )} · <a href="${siteUrl()}/api/alerts/unsubscribe?token=${i.follow.unsubscribeToken}" style="color:#94a3b8">stop this alert</a></td></tr>`,
      )
      .join("");
    const html = emailShell(
      `Alert: ${tickers} reached your margin of safety`,
      `<p style="margin:0 0 12px;font-size:14px;line-height:1.5">The latest Sievoo valuation run puts ${escapeHtml(tickers)} above the margin of safety you asked to be told about.</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`,
      `You get this because you follow these tickers on Sievoo. <a href="${siteUrl()}/account" style="color:#94a3b8">Manage alerts</a>`,
    );
    const text = items
      .map((i) => `${i.n.ticker}: ${i.follow.method} margin of safety ${formatPercent(i.mos)} - ${siteUrl()}/stock/${i.n.ticker}`)
      .join("\n");
    await sendMail({
      to: user.email,
      subject: `Sievoo alert: ${tickers}`,
      html,
      text: `${text}\n\nManage alerts: ${siteUrl()}/account`,
      listUnsubscribe: items.length === 1 ? `${siteUrl()}/api/alerts/unsubscribe?token=${items[0]!.follow.unsubscribeToken}` : undefined,
    });
  }

  logger.info({ follows: follows.length, fired }, "Alert check complete");
  return fired;
}

/**
 * Weekly digest: one email per user who follows at least one ticker (and
 * hasn't opted out), with this week's numbers for everything they follow.
 * Sent by the weekly watchlist-worker right after its refresh run.
 */
export async function sendWeeklyDigests(): Promise<number> {
  const follows = await db.select().from(tickerFollowsTable);
  if (follows.length === 0) return 0;

  const userIds = [...new Set(follows.map((f) => f.userId))];
  const users = await db
    .select()
    .from(usersTable)
    .where(and(inArray(usersTable.id, userIds), eq(usersTable.weeklyDigest, 1)));
  const numbers = await loadNumbersByTicker([...new Set(follows.map((f) => f.ticker))]);

  let sent = 0;
  for (const user of users) {
    let token = user.emailToken;
    if (!token) {
      token = newEmailToken();
      await db.update(usersTable).set({ emailToken: token }).where(eq(usersTable.id, user.id));
    }

    const mine = follows
      .filter((f) => f.userId === user.id)
      .map((f) => numbers.get(f.ticker))
      .filter((n): n is FollowedNumbers => !!n)
      .sort((a, b) => (b.dcfMos ?? -Infinity) - (a.dcfMos ?? -Infinity));
    if (mine.length === 0) continue;

    const offLink = `${siteUrl()}/api/alerts/digest-off?token=${token}`;
    const html = emailShell(
      "Your weekly Sievoo watchlist",
      `<p style="margin:0 0 12px;font-size:14px;line-height:1.5">This week's AutoDCF and Graham Number for the ${mine.length} ticker${mine.length === 1 ? "" : "s"} you follow, sorted by DCF margin of safety.</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${mine.map(numbersRow).join("")}</table><p style="margin:16px 0 0;font-size:14px"><a href="${siteUrl()}/track-record" style="color:#f59e0b">See how past valuations turned out →</a></p>`,
      `<a href="${offLink}" style="color:#94a3b8">Stop the weekly digest</a> · <a href="${siteUrl()}/account" style="color:#94a3b8">Manage alerts</a>`,
    );
    const text = mine
      .map((n) => `${n.ticker}: price ${formatMoney(n.price, n.currency)}, DCF ${formatMoney(n.baseDcf, n.currency)} (${formatPercent(n.dcfMos)})`)
      .join("\n");
    if (
      await sendMail({
        to: user.email,
        subject: "Your weekly Sievoo watchlist",
        html,
        text: `${text}\n\nStop the weekly digest: ${offLink}`,
        listUnsubscribe: offLink,
      })
    ) {
      sent++;
    }
  }

  logger.info({ users: users.length, sent }, "Weekly digests complete");
  return sent;
}
