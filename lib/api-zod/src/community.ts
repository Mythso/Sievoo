/**
 * Hand-written zod schemas for the community-growth endpoints (stock
 * pages, profiles, ticker alerts, track record). Kept outside src/generated
 * for the same reason as watchlist.ts and auth.ts: orval never overwrites
 * them, and they can be folded into openapi.yaml later.
 */
import * as zod from 'zod';

export const TickerParam = zod.object({
  "ticker": zod.string().trim().min(1).max(16).regex(/^[A-Za-z0-9][A-Za-z0-9.-]*$/)
});

export const UserIdParam = zod.object({
  "id": zod.coerce.number().int().positive()
});

/**
 * @summary Follow a ticker / update an existing follow
 */
export const FollowTickerBody = zod.object({
  "method": zod.enum(["dcf", "graham"]).default("dcf"),
  "min_margin_of_safety": zod.number().min(-50).max(500).default(20),
  "email_enabled": zod.boolean().default(true)
});

export const TokenQuery = zod.object({
  "token": zod.string().regex(/^[a-f0-9]{32,64}$/)
});
