import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const commentsTable = pgTable("comments", {
  id: serial("id").primaryKey(),
  analysisId: integer("analysis_id").notNull(),
  authorName: text("author_name").notNull(),
  commentText: text("comment_text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Commenting requires an account (cuts spam, gives every comment an
  // identity). Nullable only so comments written before this existed and
  // comments from since-deleted accounts are kept.
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
}, (t) => [index("comments_analysis_id_idx").on(t.analysisId)]);

export const insertCommentSchema = createInsertSchema(commentsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof commentsTable.$inferSelect;
