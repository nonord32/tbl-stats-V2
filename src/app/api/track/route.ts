// src/app/api/track/route.ts
// Anonymous pageview ingest. Receives { path } from <PageviewTracker />,
// derives geo from Vercel headers, manages a long-lived `tbl_vid` cookie,
// and inserts a row into public.pageviews via the service-role client.
//
// Design notes:
// - Always returns 204 (don't surface DB errors to the client).
// - Bots / asset paths / admin paths are filtered out.
// - No PII stored: just an opaque visitor UUID + geo derivatives.
import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

const VISITOR_COOKIE = 'tbl_vid';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // one year

const BOT_RE = /bot|crawl|spider|preview|prerender|headless|http-client/i;

function shouldSkipPath(path: string): boolean {
  if (!path.startsWith('/')) return true;
  if (path.startsWith('/admin')) return true;
  if (path.startsWith('/api/')) return true;
  if (path.startsWith('/auth/')) return true;
  if (path.startsWith('/_next/')) return true;
  return false;
}

export async function POST(request: Request) {
  let body: { path?: string };
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const path = (body?.path ?? '').trim().slice(0, 200);
  if (!path || shouldSkipPath(path)) {
    return new NextResponse(null, { status: 204 });
  }

  const userAgent = (request.headers.get('user-agent') ?? '').slice(0, 500);
  if (BOT_RE.test(userAgent)) {
    return new NextResponse(null, { status: 204 });
  }

  const country = request.headers.get('x-vercel-ip-country') || null;
  const city = decodeIfPresent(request.headers.get('x-vercel-ip-city'));
  const region = request.headers.get('x-vercel-ip-country-region') || null;
  const referrer = (request.headers.get('referer') ?? '').slice(0, 500) || null;

  // Read or mint the visitor cookie
  const cookieHeader = request.headers.get('cookie') ?? '';
  const existing = parseCookie(cookieHeader, VISITOR_COOKIE);
  const visitorId = existing ?? randomUUID();

  // Fire-and-forget the insert. Failures are logged but never surfaced.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceKey) {
    const supabase = createSupabaseClient(supabaseUrl, serviceKey);
    const { error } = await supabase.from('pageviews').insert({
      visitor_id: visitorId,
      path,
      country,
      city,
      region,
      referrer,
      user_agent: userAgent || null,
    });
    if (error) {
      console.error('[track] insert failed:', error.message);
    }
  }

  const response = new NextResponse(null, { status: 204 });
  if (!existing) {
    response.cookies.set(VISITOR_COOKIE, visitorId, {
      maxAge: COOKIE_MAX_AGE,
      sameSite: 'lax',
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });
  }
  return response;
}

function decodeIfPresent(value: string | null): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseCookie(header: string, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, v] = part.trim().split('=');
    if (k === name && v) return decodeURIComponent(v);
  }
  return null;
}
