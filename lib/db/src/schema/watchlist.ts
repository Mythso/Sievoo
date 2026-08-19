import {
  pgTable,
  text,
  serial,
  timestamp,
  real,
  integer,
} from "drizzle-orm/pg-core";

// Companies the admin has chosen to follow. A weekly background job
// fetches market data for each of these and stores a valuation snapshot.
export const watchlistCompaniesTable = pgTable("watchlist_companies", {
  id: serial("id").primaryKey(),
  ticker: text("ticker").notNull().unique(),
  companyName: text("company_name"),
  notes: text("notes"),
  projectionYears: integer("projection_years").notNull().default(5),
  // DCF macro assumptions, editable per company; fall back to sane
  // defaults matching the manual calculator if left untouched.
  riskFreeRate: real("risk_free_rate").notNull().default(4.5),
  marketReturn: real("market_return").notNull().default(10.0),
  costOfDebt: real("cost_of_debt").notNull().default(6.0),
  taxRate: real("tax_rate").notNull().default(21.0),
  terminalGrowth: real("terminal_growth").notNull().default(2.5),
  cushion: real("cushion").notNull().default(10.0),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
});

// Historical snapshots produced by each job run. We keep every run so
// we can show a trend and debug failures, rather than overwriting in place.
export const watchlistValuationsTable = pgTable("watchlist_valuations", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .notNull()
    .references(() => watchlistCompaniesTable.id, { onDelete: "cascade" }),
  ticker: text("ticker").notNull(),
  price: real("price"),
  revenue: real("revenue"),
  revGrowth: real("rev_growth"),
  fcfMargin: real("fcf_margin"),
  beta: real("beta"),
  shares: real("shares"),
  cash: real("cash"),
  debtTotal: real("debt_total"),
  wacc: real("wacc"),
  bearDcf: real("bear_dcf"),
  baseDcf: real("base_dcf"),
  bullDcf: real("bull_dcf"),
  marginOfSafety: real("margin_of_safety"),
  rawJson: text("raw_json"),
  status: text("status").notNull().default("ok"),
  errorMessage: text("error_message"),
  computedAt: timestamp("computed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type WatchlistCompany = typeof watchlistCompaniesTable.$inferSelect;
export type InsertWatchlistCompany = typeof watchlistCompaniesTable.$inferInsert;
export type WatchlistValuation = typeof watchlistValuationsTable.$inferSelect;
export type InsertWatchlistValuation = typeof watchlistValuationsTable.$inferInsert;
