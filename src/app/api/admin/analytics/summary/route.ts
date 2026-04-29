// src/app/api/admin/analytics/summary/route.ts
// Gated aggregate endpoint feeding the in-app analytics dashboard.
// Authorization: Bearer <ANALYTICS_SECRET>.
// All aggregation happens in Node — fine for the expected dataset size.
import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Range = '7d' | '30d' | '90d' | 'all';

interface PageviewRow {
  created_at: string;
  visitor_id: string;
  path: string;
  country: string | null;
  city: string | null;
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function rangeToSince(range: Range): string | null {
  if (range === 'all') return null;
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function dayKey(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD (UTC)
}

function topN<T>(
  rows: T[],
  keyFn: (r: T) => string | null,
  n: number
): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = keyFn(r);
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

export async function GET(request: Request) {
  const expected = process.env.ANALYTICS_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: 'ANALYTICS_SECRET is not configured.' },
      { status: 500 }
    );
  }
  const auth = request.headers.get('Authorization') ?? '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!provided || !safeEqual(provided, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const rangeParam = (url.searchParams.get('range') ?? '30d') as Range;
  const range: Range = ['7d', '30d', '90d', 'all'].includes(rangeParam)
    ? rangeParam
    : '30d';
  const since = rangeToSince(range);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: 'Supabase env vars missing.' },
      { status: 500 }
    );
  }
  const supabase = createSupabaseClient(supabaseUrl, serviceKey);

  // Cap rows fetched so the JS aggregation stays bounded. 50k rows is
  // ~10–15 MB and aggregates in well under a second.
  const HARD_CAP = 50000;
  let query = supabase
    .from('pageviews')
    .select('created_at, visitor_id, path, country, city')
    .order('created_at', { ascending: false })
    .limit(HARD_CAP);
  if (since) query = query.gte('created_at', since);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const rows = (data ?? []) as PageviewRow[];

  const totalVisits = rows.length;
  const uniqueVisitors = new Set(rows.map((r) => r.visitor_id)).size;

  // Visits-by-day series — fill in zero days so the chart isn't gappy
  const dayCounts = new Map<string, number>();
  for (const r of rows) {
    const d = dayKey(r.created_at);
    dayCounts.set(d, (dayCounts.get(d) ?? 0) + 1);
  }
  const days =
    range === 'all'
      ? Math.max(1, dayCounts.size)
      : range === '7d'
        ? 7
        : range === '30d'
          ? 30
          : 90;
  const visitsByDay: { date: string; count: number }[] = [];
  const start =
    range === 'all' && rows.length > 0
      ? new Date(rows[rows.length - 1].created_at)
      : new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);
  start.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    visitsByDay.push({ date: key, count: dayCounts.get(key) ?? 0 });
  }

  const topCountries = topN(rows, (r) => r.country, 10);

  // Cities — key by "city|country" so two cities with the same name in
  // different countries don't collide; split on the way out.
  const topCities = topN(
    rows,
    (r) => (r.city ? `${r.city}|${r.country ?? ''}` : null),
    10
  ).map(({ name, count }) => {
    const [city, country] = name.split('|');
    return { name: city, country: country || null, count };
  });

  const topPages = topN(rows, (r) => r.path, 10).map(({ name, count }) => ({
    path: name,
    count,
  }));

  // Most active anonymous visitors — first 8 chars of UUID as a stable code,
  // their visit count, last-seen, and the most-frequent country we've seen.
  const visitorMap = new Map<
    string,
    { count: number; lastSeen: string; countries: Map<string, number> }
  >();
  for (const r of rows) {
    const v = visitorMap.get(r.visitor_id);
    const country = r.country ?? '';
    if (!v) {
      const countries = new Map<string, number>();
      if (country) countries.set(country, 1);
      visitorMap.set(r.visitor_id, {
        count: 1,
        lastSeen: r.created_at,
        countries,
      });
    } else {
      v.count += 1;
      if (r.created_at > v.lastSeen) v.lastSeen = r.created_at;
      if (country) v.countries.set(country, (v.countries.get(country) ?? 0) + 1);
    }
  }
  const topVisitors = Array.from(visitorMap.entries())
    .map(([visitorId, v]) => {
      let topCountry: string | null = null;
      let topCountryCount = 0;
      for (const [c, n] of v.countries) {
        if (n > topCountryCount) {
          topCountry = c;
          topCountryCount = n;
        }
      }
      return {
        code: visitorId.replace(/-/g, '').slice(0, 8),
        count: v.count,
        lastSeen: v.lastSeen,
        country: topCountry,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  return NextResponse.json({
    range,
    totalVisits,
    uniqueVisitors,
    visitsByDay,
    topCountries,
    topCities,
    topPages,
    topVisitors,
    capped: rows.length === HARD_CAP,
  });
}
