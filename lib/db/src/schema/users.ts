import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

// Real user accounts (distinct from the single-row admin_config login used
// for the /admin panel). This is the foundation the monetization plan
// depends on: everything is free for now, but every future Pro gate
// (watchlist size, saved-analysis limits, valuation history depth, etc.)
// needs to know who's logged in, which is what this table is for.
export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  // Per-user salt + scrypt, not the admin panel's static-salt SHA-256 -
  // that shortcut was fine for a single operator password, but real user
  // accounts warrant a proper per-user salt.
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Session tokens, one row per active login (so a user can be logged in on
// multiple devices, and logging out on one doesn't affect the others).
// Unlike the admin panel's single never-expiring token, these expire.
export const userSessionsTable = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
export type UserSession = typeof userSessionsTable.$inferSelect;
export type InsertUserSession = typeof userSessionsTable.$inferInsert;
