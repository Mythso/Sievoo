import crypto from "crypto";

/**
 * Password hashing for real user accounts. Deliberately not the same
 * static-salt SHA-256 the admin panel uses (see routes/admin.ts) - that
 * pattern is acceptable for a single operator password but not for
 * potentially many users' passwords. scrypt with a per-user random salt
 * is a much stronger default and needs no extra dependency.
 */

const SCRYPT_KEY_LENGTH = 64;

export function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString("hex");
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const candidate = Buffer.from(hashPassword(password, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
