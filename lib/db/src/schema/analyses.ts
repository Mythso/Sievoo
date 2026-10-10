import { pgTable, text, serial, timestamp, real, integer, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const analysesTable = pgTable("published_analyses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  ticker: text("ticker").notNull(),
  currentPrice: real("current_price").notNull(),
  baseDcf: real("base_dcf").notNull(),
  bearDcf: real("bear_dcf").notNull(),
  bullDcf: real("bull_dcf").notNull(),
  marginOfSafety: real("margin_of_safety").notNull(),
  projectionYears: integer("projection_years").notNull().default(5),
  userNotes: text("user_notes"),
  fullInputsJson: text("full_inputs_json").notNull(),
  likesCount: integer("likes_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  authorAlias: text("author_alias").notNull(),
  editPin: text("edit_pin"),
  // Set when a logged-in account published the analysis. Owned analyses
  // can be edited/deleted by their owner without a PIN, show up on the
  // owner's public profile (/u/:id) and count towards the accuracy
  // leaderboard. Anonymous (alias + optional PIN) publishing still works.
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  // Trading currency of the ticker (ISO code, e.g. "USD", "NOK"). Null for
  // older/manual analyses, which the UI treats as USD.
  currency: text("currency"),
}, (t) => [
  index("published_analyses_user_id_idx").on(t.userId),
  index("published_analyses_ticker_idx").on(t.ticker),
]);

export const insertAnalysisSchema = createInsertSchema(analysesTable).omit({
  id: true,
  createdAt: true,
  likesCount: true,
});
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analysesTable.$inferSelect;
