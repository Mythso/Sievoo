import { Router, type IRouter } from "express";
import { TickerLookupQuery, TickerLookupResponse } from "@workspace/api-zod";
import { lookupTicker } from "../lib/market-data";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Public: look up a company name from a ticker, used to auto-fill company
// name fields (watchlist admin form, calculator) as soon as a ticker is typed.
router.get("/ticker-lookup", async (req, res): Promise<void> => {
  const parsed = TickerLookupQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const result = await lookupTicker(parsed.data.ticker);
    res.json(
      TickerLookupResponse.parse({
        ticker: result.ticker,
        company_name: result.companyName,
      }),
    );
  } catch (err) {
    logger.warn({ err, ticker: parsed.data.ticker }, "Ticker lookup failed");
    // Not found / lookup failure isn't a hard error for the frontend -
    // just report no name so the user can type one in manually.
    res.json(TickerLookupResponse.parse({ ticker: parsed.data.ticker.toUpperCase(), company_name: null }));
  }
});

export default router;
