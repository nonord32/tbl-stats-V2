// src/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
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

// Auth-only allow-list. Public ISR pages (home, teams, fighters, schedule,
// results, awards, playoffs, matches/*, stats/*) skip middleware entirely
// so Vercel's edge can serve cached HTML without booting a function.
// /auth/* and /api/auth/* are intentionally absent — those routes own their
// own cookie lifecycle and we previously had to early-return for them.
export const config = {
  matcher: [
    '/bracket/:path*',
    '/admin/:path*',
    '/leaderboard/:path*',
    '/fantasy/:path*',
    '/api/bracket/:path*',
    '/api/resolve/:path*',
    '/api/whoami/:path*',
    '/api/profile/:path*',
    '/api/fantasy/:path*',
    '/api/admin/:path*',
  ],
};
