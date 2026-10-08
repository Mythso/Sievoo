import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { db, adminConfigTable, contactMessagesTable } from "@workspace/db";
import {
  AdminAuthBody,
  AdminAuthResponse,
  ListAdminMessagesResponse,
  ListAdminMessagesHeader,
  UpdateAdminMessageParams,
  UpdateAdminMessageHeader,
  UpdateAdminMessageBody,
  UpdateAdminMessageResponse,
  DeleteAdminMessageParams,
  DeleteAdminMessageHeader,
  UpdateAdminPasswordHeader,
  UpdateAdminPasswordBody,
  UpdateAdminPasswordResponse,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";
import {
  createStoredPasswordHash,
  generateSessionToken,
  isStoredPasswordHash,
  safeEqual,
  verifyStoredPasswordHash,
} from "../lib/password";

const router: IRouter = Router();

/**
 * Admin password storage.
 *
 * Hashes are stored as "scrypt$<salt>$<hash>" (see lib/password.ts). Older
 * installs stored an unsalted-per-password SHA-256 hash; those are still
 * accepted once and transparently upgraded to scrypt on the next successful
 * login or password change.
 */
const LEGACY_SALT = "sievoo_salt_v1";
const LEGACY_DEFAULT_PASSWORD = "AdminPass123!";

function legacyHash(password: string): string {
  return crypto.createHash("sha256").update(password + LEGACY_SALT).digest("hex");
}

function verifyAdminPassword(password: string, stored: string): boolean {
  if (isStoredPasswordHash(stored)) return verifyStoredPasswordHash(password, stored);
  return safeEqual(legacyHash(password), stored);
}

async function ensureAdminExists(): Promise<void> {
  const [existing] = await db.select().from(adminConfigTable).limit(1);

  if (existing) {
    if (!isStoredPasswordHash(existing.passwordHash) && safeEqual(existing.passwordHash, legacyHash(LEGACY_DEFAULT_PASSWORD))) {
      logger.warn("Admin is still using the old default password - change it in /admin immediately");
    }
    return;
  }

  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (!initialPassword) {
    logger.warn("No admin account exists. Set ADMIN_INITIAL_PASSWORD and restart to create one.");
    return;
  }

  await db.insert(adminConfigTable).values({
    passwordHash: createStoredPasswordHash(initialPassword),
    sessionToken: null,
  });
  logger.info("Admin account created from ADMIN_INITIAL_PASSWORD - you can remove the variable now");
}

// Initialize admin on module load
ensureAdminExists().catch((err) => logger.error({ err }, "Failed to init admin config"));

export async function verifyAdminToken(token: string): Promise<boolean> {
  if (!token) return false;
  const [admin] = await db.select().from(adminConfigTable).limit(1);
  return !!admin?.sessionToken && safeEqual(admin.sessionToken, token);
}

// Simple rate limiter for auth
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

router.post("/admin/auth", async (req, res): Promise<void> => {
  const ip = (req.headers["x-forwarded-for"] as string) || req.ip || "unknown";
  if (!checkAuthRateLimit(ip)) {
    res.status(429).json({ error: "Too many attempts. Please wait 15 minutes." });
    return;
  }

  const parsed = AdminAuthBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [admin] = await db.select().from(adminConfigTable).limit(1);
  if (!admin || !verifyAdminPassword(parsed.data.password, admin.passwordHash)) {
    res.status(401).json({ error: "Invalid password" });
    return;
  }

  const token = generateSessionToken();
  const upgradedHash = isStoredPasswordHash(admin.passwordHash)
    ? undefined
    : createStoredPasswordHash(parsed.data.password);
  await db
    .update(adminConfigTable)
    .set({ sessionToken: token, ...(upgradedHash ? { passwordHash: upgradedHash } : {}) })
    .where(eq(adminConfigTable.id, admin.id));
  if (upgradedHash) logger.info("Admin password hash upgraded to scrypt");

  res.json(AdminAuthResponse.parse({ token }));
});

router.get("/admin/messages", async (req, res): Promise<void> => {
  const headers = ListAdminMessagesHeader.safeParse({
    "x-admin-token": req.headers["x-admin-token"],
  });
  if (!headers.success || !(await verifyAdminToken(headers.data["x-admin-token"]))) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const rows = await db
    .select()
    .from(contactMessagesTable)
    .orderBy(contactMessagesTable.createdAt);

  const messages = rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    subject: r.subject,
    message: r.message,
    created_at: r.createdAt.toISOString(),
    read_status: r.readStatus,
  }));

  res.json(ListAdminMessagesResponse.parse(messages));
});

router.patch("/admin/messages/:id", async (req, res): Promise<void> => {
  const headers = UpdateAdminMessageHeader.safeParse({
    "x-admin-token": req.headers["x-admin-token"],
  });
  if (!headers.success || !(await verifyAdminToken(headers.data["x-admin-token"]))) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = UpdateAdminMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateAdminMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Partial<typeof contactMessagesTable.$inferInsert> = {};
  if (parsed.data.read_status != null) updates.readStatus = parsed.data.read_status;

  const [updated] = await db
    .update(contactMessagesTable)
    .set(updates)
    .where(eq(contactMessagesTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Message not found" });
    return;
  }

  res.json(
    UpdateAdminMessageResponse.parse({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      subject: updated.subject,
      message: updated.message,
      created_at: updated.createdAt.toISOString(),
      read_status: updated.readStatus,
    }),
  );
});

router.delete("/admin/messages/:id", async (req, res): Promise<void> => {
  const headers = DeleteAdminMessageHeader.safeParse({
    "x-admin-token": req.headers["x-admin-token"],
  });
  if (!headers.success || !(await verifyAdminToken(headers.data["x-admin-token"]))) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = DeleteAdminMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(contactMessagesTable)
    .where(eq(contactMessagesTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Message not found" });
    return;
  }

  res.sendStatus(204);
});

router.put("/admin/password", async (req, res): Promise<void> => {
  const headers = UpdateAdminPasswordHeader.safeParse({
    "x-admin-token": req.headers["x-admin-token"],
  });
  if (!headers.success || !(await verifyAdminToken(headers.data["x-admin-token"]))) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = UpdateAdminPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [admin] = await db.select().from(adminConfigTable).limit(1);
  if (!admin || !verifyAdminPassword(parsed.data.current_password, admin.passwordHash)) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  const newToken = generateSessionToken();
  await db
    .update(adminConfigTable)
    .set({
      passwordHash: createStoredPasswordHash(parsed.data.new_password),
      sessionToken: newToken,
    })
    .where(eq(adminConfigTable.id, admin.id));

  res.json(UpdateAdminPasswordResponse.parse({ token: newToken }));
});

export default router;
