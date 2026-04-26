// src/app/auth/callback/route.ts
// OAuth callback (Google) + post-confirmation magic-link landing.
//
// Uses the official Supabase Next.js pattern: a route-handler-scoped
// supabase client backed by next/headers cookies(). exchangeCodeForSession
// will write the auth cookies via that handle, and Next.js attaches them
// to whatever response the handler returns. The earlier "carry cookies onto
// a pre-built NextResponse.redirect" pattern wasn't reliably propagating
// the cookies on iOS Safari.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/picks';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  // Honor Vercel's x-forwarded-host so the redirect lands on the user-facing
  // domain (tblstats.com) rather than the internal Vercel hostname.
  const forwardedHost = request.headers.get('x-forwarded-host');
  const isLocal = process.env.NODE_ENV === 'development';
  const target =
    !isLocal && forwardedHost
      ? `https://${forwardedHost}${next}`
      : `${origin}${next}`;
  return NextResponse.redirect(target);
}
