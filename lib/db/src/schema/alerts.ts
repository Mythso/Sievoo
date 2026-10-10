import {
  pgTable,
  text,
  serial,
  timestamp,
  real,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// "Follow ticker" alerts: a logged-in user follows a ticker and gets an
// email when the watchlist's latest valuation shows at least
// `minMarginOfSafety` percent upside by the chosen method. Checked after
// every watchlist-worker / trending-worker run (lib/alerts.ts).
export const tickerFollowsTable = pgTable(
  "ticker_follows",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    ticker: text("ticker").notNull(),
    // "dcf" = AutoDCF base-case margin of safety, "graham" = AutoValue
    // (Graham Number) margin of safety.
    method: text("method").notNull().default("dcf"),
    minMarginOfSafety: real("min_margin_of_safety").notNull().default(20),
    emailEnabled: integer("email_enabled").notNull().default(1),
    // Random token for the one-click unsubscribe link in alert emails, so
    // unsubscribing never requires logging in.
    unsubscribeToken: text("unsubscribe_token").notNull().unique(),
    // When the alert last fired. An alert fires once when the threshold is
    // crossed and re-arms only after the margin drops back below it, so a
    // stock that stays cheap doesn't send an email every week.
    lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
    armed: integer("armed").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("ticker_follows_user_ticker_idx").on(t.userId, t.ticker)],
);

export type TickerFollow = typeof tickerFollowsTable.$inferSelect;
export type InsertTickerFollow = typeof tickerFollowsTable.$inferInsert;
