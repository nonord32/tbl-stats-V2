// src/app/api/health/route.ts
// Lightweight status endpoint for uptime checks.
// Pings Google Sheets + Supabase independently and returns JSON.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// One of the public CSV sheets — a successful response means Google Sheets
// is reachable and the publish link is still valid.
const SHEETS_PROBE =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTDpxOV--xewT8SdQckLWo70ZEeupxHRcyOYui9nEPQwvbvE2bc5nkOs0JN-XUVpIXwjn3WauVLdeJw/pub?gid=1927967888&single=true&output=csv';

async function probeSheets(): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const res = await fetch(SHEETS_PROBE, {
      method: 'HEAD',
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function probeSupabase(): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // getSession doesn't hit the network for anonymous visits, so we also
    // do a lightweight table count that actually exercises the connection.
    const { error } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .limit(1);
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET() {
  const [sheets, supabase] = await Promise.all([probeSheets(), probeSupabase()]);
  const ok = sheets.ok && supabase.ok;

  return NextResponse.json(
    {
      ok,
      timestamp: new Date().toISOString(),
      sheets,
      supabase,
    },
    { status: ok ? 200 : 503 }
  );
}
