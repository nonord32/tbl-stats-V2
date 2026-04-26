// src/app/api/whoami/route.ts
// Diagnostic endpoint. Hit this in the browser (e.g. https://tblstats.com/api/whoami)
// after signing in and it will dump:
//   - which Supabase project URL the server thinks it's talking to
//   - which auth cookies the request actually carried
//   - the result of supabase.auth.getUser() (with full error if any)
//
// This lets us tell apart:
//   1. cookies didn't arrive at all  (sign-in didn't write them, or browser dropped them)
//   2. cookies arrived but supabase rejects them  (token expired, refresh broken, project mismatch)
//   3. cookies arrived and getUser succeeds       (then the bug is elsewhere)
//
// Safe to ship — does not expose tokens, only their presence + first chars.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const anonKeySet = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Only show the names + first 8 chars of cookies so we can confirm
  // the right ones are there without leaking token material.
  const allCookies = request.cookies.getAll().map((c) => ({
    name: c.name,
    valueLen: c.value.length,
    valuePrefix: c.value.slice(0, 8),
  }));
  const authCookies = allCookies.filter((c) => c.name.startsWith('sb-'));

  let userResult: unknown = null;
  let userError: { name: string; message: string; status?: number } | null = null;

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {
            // No-op for diagnostics — we don't want this endpoint to mutate state.
          },
        },
      }
    );
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      userError = {
        name: error.name,
        message: error.message,
        status: error.status,
      };
    }
    if (data?.user) {
      userResult = {
        id: data.user.id,
        email: data.user.email ?? null,
        provider: data.user.app_metadata?.provider ?? null,
      };
    }
  } catch (err) {
    userError = {
      name: 'thrown',
      message: err instanceof Error ? err.message : String(err),
    };
  }

  return NextResponse.json(
    {
      env: {
        supabaseUrl,
        anonKeySet,
        nodeEnv: process.env.NODE_ENV,
      },
      request: {
        host: request.headers.get('host'),
        forwardedHost: request.headers.get('x-forwarded-host'),
        forwardedProto: request.headers.get('x-forwarded-proto'),
        url: request.url,
      },
      cookies: {
        total: allCookies.length,
        authCookieNames: authCookies.map((c) => c.name),
        authCookieCount: authCookies.length,
        sampleCookieNames: allCookies.slice(0, 20).map((c) => c.name),
      },
      session: {
        user: userResult,
        error: userError,
      },
    },
    { status: 200 }
  );
}
