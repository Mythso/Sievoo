import { pgTable, text, serial } from "drizzle-orm/pg-core";

export const adminConfigTable = pgTable("admin_config", {
  id: serial("id").primaryKey(),
  passwordHash: text("password_hash").notNull(),
  sessionToken: text("session_token"),
});
