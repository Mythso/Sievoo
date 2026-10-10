import type { Request } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, userSessionsTable, type User } from "@workspace/db";

/**
 * Resolves a session token to its user. Lazily deletes the session if it's
 * expired rather than requiring a separate cleanup job.
 */
export async function getUserFromToken(token: string): Promise<User | null> {
  const [session] = await db
    .select()
    .from(userSessionsTable)
    .where(eq(userSessionsTable.token, token));

  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now()) {
    await db.delete(userSessionsTable).where(eq(userSessionsTable.id, session.id));
    return null;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.userId));
  return user ?? null;
}

/**
 * Reads the session token from a request. The frontend sends it as
 * `Authorization: Bearer <token>` (set once via the generated API client's
 * auth-token getter), and the older account endpoints used `x-auth-token`;
 * both are accepted.
 */
export function getRequestToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }
  const legacy = req.headers["x-auth-token"];
  if (typeof legacy === "string" && legacy.trim()) return legacy.trim();
  return null;
}

/** The logged-in user for this request, or null for anonymous visitors. */
export async function getRequestUser(req: Request): Promise<User | null> {
  const token = getRequestToken(req);
  if (!token) return null;
  return getUserFromToken(token);
}

/**
 * The name shown publicly for an account (profile pages, analysis cards,
 * comments). Accounts without a display name get a stable, non-identifying
 * fallback - the email address is never shown publicly.
 */
export function publicName(user: Pick<User, "id" | "displayName">): string {
  const name = user.displayName?.trim();
  return name ? name : `Investor #${user.id}`;
}
