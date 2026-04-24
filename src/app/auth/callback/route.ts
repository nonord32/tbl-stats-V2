// src/app/auth/callback/route.ts
// OAuth callback (Google) + post-confirmation magic-link landing.
//
// We build the redirect response up front and have the Supabase client write
// auth cookies directly onto it via response.cookies.set(). The earlier flow
// went through next/headers cookies() — which technically should attach to
// the response — but iOS Safari was sometimes ending up cookie-less after
// the redirect, leaving the user signed out and bounced to /login (which
// looks like the home screen on a phone). This pattern guarantees the
// Set-Cookie headers ride on the 302 the browser must follow.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/picks';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  const successResponse = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            successResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }
  return successResponse;
}
