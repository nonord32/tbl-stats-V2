// src/lib/api/http.ts
// Shared response helpers for the public, read-only /api/v1 endpoints:
// CORS allow-list, cache headers and a uniform JSON error shape.

import { NextResponse } from 'next/server';

// ─── CORS ──────────────────────────────────────────────────────────────────────
// Allowed browser origins:
//   • https://teamboxingleague.com (and www.)
//   • https://<anything>.myshopify.com  (Shopify storefront / theme previews)
//   • http://127.0.0.1:9292             (Shopify CLI `shopify theme dev`)
const EXACT_ORIGINS = new Set([
  'https://teamboxingleague.com',
  'https://www.teamboxingleague.com',
  'http://127.0.0.1:9292',
]);

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (EXACT_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    return (
      url.protocol === 'https:' &&
      url.port === '' &&
      url.hostname.endsWith('.myshopify.com')
    );
  } catch {
    return false;
  }
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = {
    // Responses differ by Origin, so caches must key on it.
    Vary: 'Origin',
  };
  if (isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin!;
    headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return headers;
}

// ─── Caching ───────────────────────────────────────────────────────────────────
// Browsers keep a copy for 1 minute; Vercel's CDN keeps it for 5 minutes and may
// serve a slightly stale copy for up to 10 more while it refreshes in the
// background. Underneath, the Google-Sheet CSV fetches are cached too (see
// fetchRawCSV in src/lib/data.ts), so the sheet is never hit per request.
const CACHE_OK = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';
const CACHE_NOT_FOUND = 'public, max-age=60, s-maxage=60';
const CACHE_NONE = 'no-store';

export function jsonOk(request: Request, body: unknown): NextResponse {
  return NextResponse.json(body, {
    status: 200,
    headers: { ...corsHeaders(request), 'Cache-Control': CACHE_OK },
  });
}

export function jsonError(
  request: Request,
  status: number,
  code: string,
  message: string,
): NextResponse {
  const cache = status === 404 || status === 400 ? CACHE_NOT_FOUND : CACHE_NONE;
  return NextResponse.json(
    { error: { status, code, message } },
    { status, headers: { ...corsHeaders(request), 'Cache-Control': cache } },
  );
}

// Browser CORS preflight.
export function preflight(request: Request): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

// Wrap a handler so any unexpected exception becomes a clean JSON 500
// instead of an HTML error page.
export async function safely(
  request: Request,
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    console.error('[api/v1] unhandled error:', err);
    return jsonError(request, 500, 'internal_error', 'Something went wrong. Please try again shortly.');
  }
}
