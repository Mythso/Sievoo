/**
 * Hand-written zod schemas for the watchlist endpoints.
 * NOTE: kept outside src/generated on purpose so orval never overwrites it.
 * If/when the openapi.yaml is regenerated with these routes added, these
 * can be folded into the generated file and this one deleted.
 */
import * as zod from 'zod';

export const InsiderTransactionItem = zod.object({
  "filer": zod.string().nullish(),
  "relation": zod.string().nullish(),
  "transaction_text": zod.string().nullish(),
  "shares": zod.number().nullish(),
  "value": zod.number().nullish(),
  "date": zod.string().nullish()
});

export const WatchlistValuationSnapshot = zod.object({
  "price": zod.number().nullish(),
  "revenue": zod.number().nullish(),
  "rev_growth": zod.number().nullish(),
  "fcf_margin": zod.number().nullish(),
  "beta": zod.number().nullish(),
  "wacc": zod.number().nullish(),
  "bear_dcf": zod.number().nullish(),
  "base_dcf": zod.number().nullish(),
  "bull_dcf": zod.number().nullish(),
  "margin_of_safety": zod.number().nullish(),
  // AutoValue (Graham Number), computed alongside AutoDCF.
  "eps": zod.number().nullish(),
  "book_value_per_share": zod.number().nullish(),
  "graham_number": zod.number().nullish(),
  "graham_margin_of_safety": zod.number().nullish(),
  "insider_score": zod.number().nullish(),
  "insider_transactions": zod.array(InsiderTransactionItem).nullish(),
  "status": zod.enum(['ok', 'error']),
  "error_message": zod.string().nullish(),
  "computed_at": zod.string()
});

export const WatchlistCompanyItem = zod.object({
  "id": zod.number(),
  "ticker": zod.string(),
  "company_name": zod.string().nullish(),
  "notes": zod.string().nullish(),
  "projection_years": zod.number(),
  "auto_publish": zod.boolean(),
  "published_analysis_id": zod.number().nullish(),
  "added_at": zod.string(),
  "latest_valuation": WatchlistValuationSnapshot.nullish()
});

/**
 * @summary List followed companies with their latest valuation
 */
export const ListWatchlistResponse = zod.object({
  "items": zod.array(WatchlistCompanyItem)
});

/**
 * @summary Add a company to the watchlist (admin)
 */
export const AddWatchlistCompanyHeader = zod.object({
  "x-admin-token": zod.string()
});

export const AddWatchlistCompanyBody = zod.object({
  "ticker": zod.string().min(1).max(10),
  "company_name": zod.string().nullish(),
  "notes": zod.string().nullish(),
  "projection_years": zod.number().nullish(),
  "auto_publish": zod.boolean().nullish()
});

export const AddWatchlistCompanyResponse = WatchlistCompanyItem;

/**
 * @summary Remove a company from the watchlist (admin)
 */
export const DeleteWatchlistCompanyParams = zod.object({
  "id": zod.coerce.number()
});

export const DeleteWatchlistCompanyHeader = zod.object({
  "x-admin-token": zod.string()
});

export const DeleteWatchlistCompanyResponse = zod.void();

/**
 * @summary Manually trigger a watchlist refresh run (admin)
 */
export const RefreshWatchlistHeader = zod.object({
  "x-admin-token": zod.string()
});

export const RefreshWatchlistResultItem = zod.object({
  "ticker": zod.string(),
  "status": zod.enum(['ok', 'error']),
  "error_message": zod.string().nullish()
});

export const RefreshWatchlistResponse = zod.object({
  "updated": zod.number(),
  "failed": zod.number(),
  "results": zod.array(RefreshWatchlistResultItem)
});


/**
 * @summary Get the valuation history for a watchlist company (admin, for the Statistics tab)
 */
export const WatchlistHistoryParams = zod.object({
  "id": zod.coerce.number()
});

export const WatchlistHistoryHeader = zod.object({
  "x-admin-token": zod.string()
});

export const WatchlistHistoryPoint = zod.object({
  "computed_at": zod.string(),
  "price": zod.number().nullish(),
  "bear_dcf": zod.number().nullish(),
  "base_dcf": zod.number().nullish(),
  "bull_dcf": zod.number().nullish(),
  "margin_of_safety": zod.number().nullish(),
  "graham_number": zod.number().nullish(),
  "graham_margin_of_safety": zod.number().nullish()
});

export const WatchlistHistoryResponse = zod.object({
  "id": zod.number(),
  "ticker": zod.string(),
  "company_name": zod.string().nullish(),
  "points": zod.array(WatchlistHistoryPoint)
});

/**
 * @summary Look up a company name from a ticker (public)
 */
export const TickerLookupQuery = zod.object({
  "ticker": zod.string().min(1).max(10)
});

export const TickerLookupResponse = zod.object({
  "ticker": zod.string(),
  "company_name": zod.string().nullable()
});
