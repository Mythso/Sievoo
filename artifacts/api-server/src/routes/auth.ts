import { Router, type IRouter } from "express";
import { eq, lt } from "drizzle-orm";
import { db, usersTable, userSessionsTable, analysesTable, commentsTable } from "@workspace/db";
import { SignupBody, LoginBody, AuthResponse, MeResponse, UpdateMeBody } from "@workspace/api-zod";
import { generateSalt, hashPassword, verifyPassword, generateSessionToken } from "../lib/password";
import { getRequestToken, getRequestUser, getUserFromToken, publicName } from "../lib/sessions";
import { logger } from "../lib/logger";

export { getUserFromToken };

const router: IRouter = Router();

// Sessions last 90 days; logging in again always mints a fresh one rather
// than extending an old one, so a stolen token from months ago eventually
// stops working on its own.
const SESSION_DURATION_MS = 90 * 24 * 60 * 60 * 1000;

// Same shape of per-IP rate limiter as the admin login (routes/admin.ts).
const authAttempts = new Map<string, { count: number; resetAt: number }>();
function checkAuthRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = authAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    authAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

function toPublicUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    email: u.email,
    display_name: u.displayName,
    created_at: u.createdAt.toISOString(),
    weekly_digest: !!u.weeklyDigest,
  };
}

async function createSession(userId: number): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.insert(userSessionsTable).values({ userId, token, expiresAt });
  return token;
}

router.post("/auth/signup", async (req, res): Promise<void> => {
  const ip = (req.headers["x-forwarded-for"] as string) || req.ip || "unknown";
  if (!checkAuthRateLimit(ip)) {
    res.status(429).json({ error: "Too many attempts. Please wait 15 minutes." });
    return;
  }

  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const email = parsed.data.email.toLowerCase().trim();

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists." });
    return;
  }

  const passwordSalt = generateSalt();
  const passwordHash = hashPassword(parsed.data.password, passwordSalt);

  const [user] = await db
    .insert(usersTable)
    .values({
      email,
      passwordHash,
      passwordSalt,
      displayName: parsed.data.display_name || null,
    })
    .returning();

  if (!user) {
    res.status(500).json({ error: "Failed to create account" });
    return;
  }

  const token = await createSession(user.id);
  logger.info({ userId: user.id }, "New user signed up");

  res.status(201).json(AuthResponse.parse({ token, user: toPublicUser(user) }));
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const ip = (req.headers["x-forwarded-for"] as string) || req.ip || "unknown";
  if (!checkAuthRateLimit(ip)) {
    res.status(429).json({ error: "Too many attempts. Please wait 15 minutes." });
    return;
  }

  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const email = parsed.data.email.toLowerCase().trim();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  // Same "invalid email or password" message either way, so a login
  // attempt can't be used to enumerate which emails have accounts.
  if (!user || !verifyPassword(parsed.data.password, user.passwordSalt, user.passwordHash)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = await createSession(user.id);
  res.json(AuthResponse.parse({ token, user: toPublicUser(user) }));
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const token = getRequestToken(req);
  if (token) {
    await db.delete(userSessionsTable).where(eq(userSessionsTable.token, token));
  }
  // Logging out is idempotent - a missing/already-invalid token still
  // returns success, since the end state (no valid session) is the same.
  res.sendStatus(204);
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const user = await getRequestUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  res.json(MeResponse.parse(toPublicUser(user)));
});

// Update the logged-in user's public display name and email preferences.
// The display name is what appears on published analyses, comments, the
// public profile page and the leaderboard.
router.patch("/auth/me", async (req, res): Promise<void> => {
  const user = await getRequestUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (parsed.data.display_name !== undefined) updates.displayName = parsed.data.display_name ?? null;
  if (parsed.data.weekly_digest !== undefined) updates.weeklyDigest = parsed.data.weekly_digest ? 1 : 0;

  if (Object.keys(updates).length === 0) {
    res.json(MeResponse.parse(toPublicUser(user)));
    return;
  }

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id)).returning();

  // Keep the name on the user's existing analyses and comments in sync,
  // so a rename shows everywhere (cards, comments, leaderboard).
  if (updated && "displayName" in updates) {
    const name = publicName(updated);
    await db.update(analysesTable).set({ authorAlias: name }).where(eq(analysesTable.userId, user.id));
    await db.update(commentsTable).set({ authorName: name }).where(eq(commentsTable.userId, user.id));
  }

  res.json(MeResponse.parse(toPublicUser(updated ?? user)));
});

// Best-effort cleanup of expired sessions on module load, so the table
// doesn't grow unbounded. Not a scheduled job - just a courtesy sweep each
// time the API server restarts/deploys.
db.delete(userSessionsTable)
  .where(lt(userSessionsTable.expiresAt, new Date()))
  .catch((err) => logger.warn({ err }, "Failed to sweep expired user sessions"));

export default router;
