import { Router, type IRouter, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, analysesTable } from "@workspace/db";
import { getCompanyByTicker, getLatestOkValuation } from "../lib/stock-data";
import { renderAnalysisImage, renderGenericImage, renderProfileImage, renderStockImage } from "../lib/og-image";
import { loadProfile } from "./users";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Rendered images are cached in memory for an hour (and by browsers/CDNs
// via Cache-Control), so a link going viral doesn't re-render per view.
const TTL_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 500;
const cache = new Map<string, { png: Buffer; expiresAt: number }>();

async function serve(res: Response, key: string, build: () => Promise<Buffer | null>): Promise<void> {
  const hit = cache.get(key);
  let png = hit && hit.expiresAt > Date.now() ? hit.png : null;
  if (!png) {
    try {
      png = await build();
    } catch (err) {
      logger.error({ err, key }, "Share image render failed");
      png = null;
    }
    if (!png) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
    cache.set(key, { png, expiresAt: Date.now() + TTL_MS });
  }
  res.set("Content-Type", "image/png");
  res.set("Cache-Control", "public, max-age=3600");
  res.send(png);
}

router.get("/og/stock/:ticker.png", async (req, res): Promise<void> => {
  const ticker = String(req.params.ticker ?? "").toUpperCase();
  await serve(res, `stock:${ticker}`, async () => {
    const company = await getCompanyByTicker(ticker);
    if (!company) return null;
    const v = await getLatestOkValuation(company.id);
    return renderStockImage({
      ticker: company.ticker,
      companyName: company.companyName,
      currency: v?.currency ?? null,
      price: v?.price ?? null,
      baseDcf: v?.baseDcf ?? null,
      grahamNumber: v?.grahamNumber ?? null,
      marginOfSafety: v?.marginOfSafety ?? null,
      computedAt: v?.computedAt.toISOString() ?? null,
    });
  });
});

router.get("/og/analysis/:id.png", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await serve(res, `analysis:${id}`, async () => {
    const [a] = await db.select().from(analysesTable).where(eq(analysesTable.id, id));
    if (!a) return null;
    return renderAnalysisImage({
      ticker: a.ticker,
      title: a.title,
      author: a.authorAlias,
      currency: a.currency,
      price: a.currentPrice,
      bear: a.bearDcf,
      base: a.baseDcf,
      bull: a.bullDcf,
      marginOfSafety: a.marginOfSafety,
    });
  });
});

router.get("/og/user/:id.png", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await serve(res, `user:${id}`, async () => {
    const p = await loadProfile(id);
    if (!p) return null;
    return renderProfileImage({
      name: p.name,
      analyses: p.analyses_count,
      hitRate: p.track?.hit_rate ?? null,
      evaluated: p.track?.evaluated ?? 0,
      rank: p.track?.rank ?? null,
    });
  });
});

const PAGES: Record<string, [string, string]> = {
  stocks: ["Stock valuations", "DCF + Graham Number for US and Oslo Børs stocks"],
  "track-record": ["Track record", "How past valuations turned out - checked against real prices"],
};

router.get("/og/page/:name.png", async (req, res): Promise<void> => {
  const page = PAGES[String(req.params.name)];
  if (!page) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await serve(res, `page:${req.params.name}`, async () => renderGenericImage(page[0], page[1]));
});

export default router;
