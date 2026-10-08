import crypto from "crypto";

/**
 * Password hashing for user accounts and the admin panel: scrypt with a
 * random salt per password. Needs no extra dependency.
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

/**
 * Self-describing hash for a single stored password (used by the admin panel):
 * "scrypt$<salt>$<hash>". Lets the salt live alongside the hash without a
 * separate column.
 */
const STORED_HASH_PREFIX = "scrypt$";

export function createStoredPasswordHash(password: string): string {
  const salt = generateSalt();
  return `${STORED_HASH_PREFIX}${salt}$${hashPassword(password, salt)}`;
}

export function isStoredPasswordHash(value: string): boolean {
  return value.startsWith(STORED_HASH_PREFIX);
}

export function verifyStoredPasswordHash(password: string, stored: string): boolean {
  if (!isStoredPasswordHash(stored)) return false;
  const [, salt, hash] = stored.split("$");
  if (!salt || !hash) return false;
  return verifyPassword(password, salt, hash);
}

/** Constant-time comparison of two hex/string tokens. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}
