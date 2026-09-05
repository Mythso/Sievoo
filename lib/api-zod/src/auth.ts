/**
 * Hand-written zod schemas for the user account endpoints (signup/login/
 * logout/me). Kept outside src/generated for the same reason as
 * lib/api-zod/src/watchlist.ts: orval never overwrites it, and it can be
 * folded into the generated file once these routes are added to
 * openapi.yaml.
 */
import * as zod from 'zod';

export const SignupBody = zod.object({
  "email": zod.string().email().max(320),
  "password": zod.string().min(8).max(200),
  "display_name": zod.string().min(1).max(60).nullish()
});

export const LoginBody = zod.object({
  "email": zod.string().email().max(320),
  "password": zod.string().min(1).max(200)
});

export const AuthHeader = zod.object({
  "x-auth-token": zod.string()
});

export const UserPublic = zod.object({
  "id": zod.number(),
  "email": zod.string(),
  "display_name": zod.string().nullish(),
  "created_at": zod.string()
});

/**
 * @summary Sign up or log in - both return a session token + the user
 */
export const AuthResponse = zod.object({
  "token": zod.string(),
  "user": UserPublic
});

/**
 * @summary Get the currently logged-in user
 */
export const MeResponse = UserPublic;
