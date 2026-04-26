// src/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // ── Canonical host: force www.tblstats.com → tblstats.com ──────────────
  // Supabase Auth's redirect URL whitelist contains https://tblstats.com/
  // auth/callback but NOT the www variant. If a user signs in while on
  // www.tblstats.com, Supabase rejects the redirectTo, falls back to the
  // Site URL ("home"), and the OAuth flow never reaches /auth/callback —
  // so the session cookies never get written. Bouncing them to the apex
  // domain BEFORE any auth flow starts keeps the whole journey on the
  // whitelisted host.
  const host = request.headers.get('host') ?? '';
  if (host.toLowerCase().startsWith('www.')) {
    const url = request.nextUrl.clone();
    url.host = host.slice(4);
    return NextResponse.redirect(url, 308);
  }

  // Skip middleware entirely on auth routes. The route handlers there
  // (/auth/callback, /api/auth/*, /auth/signout) own the full cookie
  // lifecycle for that request — having the middleware also call
  // supabase.auth.getUser() and potentially write cookies on the same
  // response was racing with the route handler's Set-Cookie headers and
  // leaving Safari without a usable session after Google OAuth.
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/auth/') || pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired — required for Server Components
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder files (images, icons, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
};
