import { useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Session handling for user accounts. The token lives in localStorage and
 * is sent as `Authorization: Bearer <token>` on every API call - both by
 * the generated client (configured in main.tsx) and by apiFetch below.
 */
export const TOKEN_KEY = 'sievoo_user_token';
export const ME_QUERY_KEY = ['/api/auth/me'];

export interface SievooUser {
  id: number;
  email: string;
  display_name: string | null;
  created_at: string;
  weekly_digest?: boolean;
}

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** JSON fetch against the API with the session token attached. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const res = await fetch(path, { ...init, headers });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError((data && data.error) || `Request failed (${res.status})`, res.status);
  return data as T;
}

/** The logged-in user, or null. Shared cache across the whole app. */
export function useMe() {
  return useQuery<SievooUser | null>({
    queryKey: ME_QUERY_KEY,
    queryFn: async () => {
      if (!getToken()) return null;
      try {
        return await apiFetch<SievooUser>('/api/auth/me');
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setToken(null);
          return null;
        }
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
    // Pick up a login done in another tab (e.g. from the calculator's
    // publish dialog) as soon as the user comes back to this one.
    refetchOnWindowFocus: true,
  });
}

export function useAuthActions() {
  const queryClient = useQueryClient();
  return {
    signedIn(token: string, user: SievooUser) {
      setToken(token);
      queryClient.setQueryData(ME_QUERY_KEY, user);
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== ME_QUERY_KEY[0] });
    },
    async logout() {
      try {
        await apiFetch('/api/auth/logout', { method: 'POST' });
      } catch {
        // best effort
      }
      setToken(null);
      queryClient.setQueryData(ME_QUERY_KEY, null);
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== ME_QUERY_KEY[0] });
    },
    updated(user: SievooUser) {
      queryClient.setQueryData(ME_QUERY_KEY, user);
    },
  };
}

export function publicNameOf(user: Pick<SievooUser, 'id' | 'display_name'>): string {
  return user.display_name?.trim() || `Investor #${user.id}`;
}
