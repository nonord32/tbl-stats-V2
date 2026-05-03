// src/app/auth/callback/route.ts
// OAuth callback (Google) + post-confirmation magic-link landing.
//
// Build the success/error responses up front and have the supabase-ssr
// setAll callback attach the freshly-issued auth cookies directly onto
// the redirect that the browser must follow. This mirrors the pattern in
// /api/auth/login/route.ts which the team has confirmed works reliably
// across desktop and iOS Safari — the cookieStore-based pattern was not
// surviving the redirect handoff in some Vercel deployments.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/picks';

  // Honor Vercel's x-forwarded-host so the redirect lands on the user-facing
  // domain (tblstats.com) rather than an internal Vercel hostname.
  const forwardedHost = request.headers.get('x-forwarded-host');
  const isLocal = process.env.NODE_ENV === 'development';
  const successUrl =
    !isLocal && forwardedHost
      ? `https://${forwardedHost}${next}`
      : `${origin}${next}`;

  const loginPath = next.startsWith('/fantasy') ? '/fantasy/login' : '/login';
  const failUrl = (msg: string) =>
    `${origin}${loginPath}?error=${encodeURIComponent(msg)}&next=${encodeURIComponent(next)}`;

  if (!code) {
    return NextResponse.redirect(failUrl('auth_callback_failed'));
  }

  // Build the success response up front; supabase will attach Set-Cookie
  // headers to it via the setAll callback below.
  const response = NextResponse.redirect(successUrl);

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
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(failUrl(error.message));
  }
  return response;
}
