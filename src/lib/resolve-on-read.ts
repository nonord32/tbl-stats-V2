// src/lib/resolve-on-read.ts
// Lazy resolver — called from server components on every page render.
// Cheap path: one SELECT count from picks/fantasy_weeks where resolved_at
// is null. If nothing pending, returns immediately. Otherwise, scores
// whatever's resolvable from current sheet state.
//
// In-process dedupe: if a render is already resolving, reuse its promise
// so concurrent server components on the same page don't fan out work.
// Cross-process dedupe is handled by the idempotent UPDATEs in resolve.ts.
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ParsedSheetData } from '@/types';
import { resolveAllPendingPickem, resolveAllPendingFantasy } from './resolve';

let inFlight: Promise<void> | null = null;

function buildServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    return createServiceClient(url, key);
  } catch (err) {
    console.error('[resolve-on-read] service client construction failed:', err);
    return null;
  }
}

/**
 * Resolve any picks/fantasy weeks that are now scorable from sheet state.
 * Idempotent + concurrency-safe. Pass the already-fetched sheet data so we
 * don't re-fetch (callers usually have it from getAllData()).
 */
export async function ensureResolved(sheet: ParsedSheetData): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const supabase = buildServiceClient();
      if (!supabase) return;
      await Promise.all([
        resolveAllPendingPickem(supabase, sheet).catch((err) =>
          console.error('[resolve-on-read] pickem failed:', err)
        ),
        resolveAllPendingFantasy(supabase, sheet).catch((err) =>
          console.error('[resolve-on-read] fantasy failed:', err)
        ),
      ]);
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}
