import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, tickerFollowsTable, usersTable } from "@workspace/db";
import { FollowTickerBody, TickerParam, TokenQuery } from "@workspace/api-zod";
import { getRequestUser } from "../lib/sessions";
import { getCompanyByTicker, getLatestOkValuations } from "../lib/stock-data";
import { newEmailToken } from "../lib/alerts";
import { escapeHtml, isMailConfigured, siteUrl } from "../lib/mailer";

const router: IRouter = Router();

const MAX_FOLLOWS_PER_USER = 50;

// The logged-in user's followed tickers with current numbers.
router.get("/follows", async (req, res): Promise<void> => {
  const user = await getRequestUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const follows = await db
    .select()
    .from(tickerFollowsTable)
    .where(eq(tickerFollowsTable.userId, user.id))
    .orderBy(tickerFollowsTable.ticker);
  const latest = await getLatestOkValuations();

  const items = [];
  for (const f of follows) {
    const company = await getCompanyByTicker(f.ticker);
    const v = company ? latest.get(company.id) : undefined;
    items.push({
      ticker: f.ticker,
      company_name: company?.companyName ?? null,
      method: f.method,
      min_margin_of_safety: f.minMarginOfSafety,
      email_enabled: !!f.emailEnabled,
      last_triggered_at: f.lastTriggeredAt?.toISOString() ?? null,
      currency: v?.currency ?? null,
      price: v?.price ?? null,
      base_dcf: v?.baseDcf ?? null,
      graham_number: v?.grahamNumber ?? null,
      margin_of_safety: v?.marginOfSafety ?? null,
      graham_margin_of_safety: v?.grahamMarginOfSafety ?? null,
    });
  }

  res.json({ items, email_configured: isMailConfigured(), weekly_digest: !!user.weeklyDigest });
});

// Follow a ticker (or update the alert settings of an existing follow).
router.put("/follows/:ticker", async (req, res): Promise<void> => {
  const user = await getRequestUser(req);
  if (!user) {
    res.status(401).json({ error: "Log in to follow tickers" });
    return;
  }
  const params = TickerParam.safeParse(req.params);
  const body = FollowTickerBody.safeParse(req.body ?? {});
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const ticker = params.data.ticker.toUpperCase();

  if (!(await getCompanyByTicker(ticker))) {
    res.status(404).json({ error: `${ticker} is not tracked yet` });
    return;
  }

  const [existing] = await db
    .select()
    .from(tickerFollowsTable)
    .where(and(eq(tickerFollowsTable.userId, user.id), eq(tickerFollowsTable.ticker, ticker)));

  if (existing) {
    await db
      .update(tickerFollowsTable)
      .set({
        method: body.data.method,
        minMarginOfSafety: body.data.min_margin_of_safety,
        emailEnabled: body.data.email_enabled ? 1 : 0,
        // New settings: let the alert fire again against the new threshold.
        armed: 1,
      })
      .where(eq(tickerFollowsTable.id, existing.id));
  } else {
    const all = await db.select({ id: tickerFollowsTable.id }).from(tickerFollowsTable).where(eq(tickerFollowsTable.userId, user.id));
    if (all.length >= MAX_FOLLOWS_PER_USER) {
      res.status(400).json({ error: `You can follow up to ${MAX_FOLLOWS_PER_USER} tickers` });
      return;
    }
    await db.insert(tickerFollowsTable).values({
      userId: user.id,
      ticker,
      method: body.data.method,
      minMarginOfSafety: body.data.min_margin_of_safety,
      emailEnabled: body.data.email_enabled ? 1 : 0,
      unsubscribeToken: newEmailToken(),
    });
  }

  res.json({
    ticker,
    method: body.data.method,
    min_margin_of_safety: body.data.min_margin_of_safety,
    email_enabled: body.data.email_enabled,
  });
});

router.delete("/follows/:ticker", async (req, res): Promise<void> => {
  const user = await getRequestUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = TickerParam.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ticker" });
    return;
  }
  await db
    .delete(tickerFollowsTable)
    .where(and(eq(tickerFollowsTable.userId, user.id), eq(tickerFollowsTable.ticker, params.data.ticker.toUpperCase())));
  res.sendStatus(204);
});

function confirmationPage(title: string, message: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)} | Sievoo</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0f19;color:#e5e7eb;font-family:Arial,Helvetica,sans-serif;padding:16px">
<div style="max-width:440px;background:#1e293b;border-radius:12px;padding:28px;text-align:center"><div style="font-family:'Courier New',monospace;font-weight:bold;color:#f59e0b;font-size:20px;margin-bottom:16px">Sievoo</div><h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1><p style="color:#94a3b8;line-height:1.5;margin:0 0 20px">${escapeHtml(message)}</p><a href="${siteUrl()}/account" style="color:#f59e0b">Manage alerts</a></div></body></html>`;
}

// One-click unsubscribe from a single ticker alert (link in alert emails).
async function unsubscribeFollow(token: string): Promise<string | null> {
  const [deleted] = await db
    .delete(tickerFollowsTable)
    .where(eq(tickerFollowsTable.unsubscribeToken, token))
    .returning({ ticker: tickerFollowsTable.ticker });
  return deleted?.ticker ?? null;
}

router.get("/alerts/unsubscribe", async (req, res): Promise<void> => {
  const query = TokenQuery.safeParse(req.query);
  const ticker = query.success ? await unsubscribeFollow(query.data.token) : null;
  res
    .status(ticker ? 200 : 404)
    .type("html")
    .send(
      ticker
        ? confirmationPage("Alert removed", `You no longer follow ${ticker} and won't get alerts for it.`)
        : confirmationPage("Link expired", "This alert was already removed."),
    );
});
router.post("/alerts/unsubscribe", async (req, res): Promise<void> => {
  const query = TokenQuery.safeParse(req.query);
  if (query.success) await unsubscribeFollow(query.data.token);
  res.sendStatus(204);
});

// One-click opt-out of the weekly digest (link in digest emails).
async function digestOff(token: string): Promise<boolean> {
  const [updated] = await db
    .update(usersTable)
    .set({ weeklyDigest: 0 })
    .where(eq(usersTable.emailToken, token))
    .returning({ id: usersTable.id });
  return !!updated;
}

router.get("/alerts/digest-off", async (req, res): Promise<void> => {
  const query = TokenQuery.safeParse(req.query);
  const ok = query.success ? await digestOff(query.data.token) : false;
  res
    .status(ok ? 200 : 404)
    .type("html")
    .send(
      ok
        ? confirmationPage("Weekly digest turned off", "You won't get the weekly email any more. Ticker alerts you set up still work.")
        : confirmationPage("Link expired", "We couldn't find that subscription."),
    );
});
router.post("/alerts/digest-off", async (req, res): Promise<void> => {
  const query = TokenQuery.safeParse(req.query);
  if (query.success) await digestOff(query.data.token);
  res.sendStatus(204);
});

export default router;
