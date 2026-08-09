import { pgTable, text, serial, timestamp, real, integer, boolean } from "drizzle-orm/pg-core";
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
  userNotes: text("user_notes"),
  fullInputsJson: text("full_inputs_json").notNull(),
  likesCount: integer("likes_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  authorAlias: text("author_alias").notNull(),
  editPin: text("edit_pin"),
});

export const insertAnalysisSchema = createInsertSchema(analysesTable).omit({
  id: true,
  createdAt: true,
  likesCount: true,
});
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analysesTable.$inferSelect;
