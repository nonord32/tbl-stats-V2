// src/lib/supabase/safe.ts
// Defensive wrappers so a Supabase outage doesn't take down pages that
// reference it. Every function logs the underlying error to console.error
// (surfaced in Vercel runtime logs) and returns a safe fallback.

import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Fetches the authenticated user without throwing. Returns null on any
 * failure (network, paused project, missing env vars, etc.).
 */
export async function safeGetUser(
  supabase: SupabaseClient
): Promise<User | null> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      // Not treated as exceptional — an anonymous visitor also lands here.
      // Only log when the error isn't the standard "no session" case.
      if (error.status !== 401 && error.name !== 'AuthSessionMissingError') {
        console.error('[safeGetUser] auth error:', error);
      }
      return null;
    }
    return data?.user ?? null;
  } catch (err) {
    console.error('[safeGetUser] threw:', err);
    return null;
  }
}

/**
 * Awaits a Supabase query-builder promise and returns `fallback` on any
 * failure. The Supabase client builder resolves to
 * `{ data, error }`; we treat an `error` as failure too, not just throws.
 */
export async function safeQuery<T>(
  promise: PromiseLike<{ data: T | null; error: unknown }>,
  fallback: T,
  label = 'safeQuery'
): Promise<T> {
  try {
    const { data, error } = await promise;
    if (error) {
      console.error(`[${label}] query error:`, error);
      return fallback;
    }
    return (data ?? fallback) as T;
  } catch (err) {
    console.error(`[${label}] threw:`, err);
    return fallback;
  }
}
