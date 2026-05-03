// src/app/api/auth/google/route.ts
// Server-initiated Google OAuth.
//
// Capture the cookies supabase asks us to set during signInWithOAuth (most
// importantly the PKCE code_verifier) and replay them onto the final 302
// to Google as real Set-Cookie headers. Mirrors the pattern in
// /api/auth/login/route.ts so all three auth flows (email, Google,
// callback) use the same battle-tested cookie handoff.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// Only allow same-origin path redirects so a crafted ?next= can't bounce
// the user off-site after auth.
function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//')) return null;
  return raw;
}

export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const next = safeNextPath(searchParams.get('next'));
  const captured: { name: string; value: string; options?: CookieOptions }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach((c) => captured.push(c));
        },
      },
    }
  );

  // Forward ?next= into the OAuth callback so the user lands on the page
  // they were trying to reach (e.g. /fantasy/team).
  const callbackPath = next
    ? `/auth/callback?next=${encodeURIComponent(next)}`
    : '/auth/callback';
  const errorPath = next?.startsWith('/fantasy') ? '/fantasy/login' : '/login';

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin}${callbackPath}` },
  });

  if (error || !data?.url) {
    return NextResponse.redirect(`${origin}${errorPath}?error=oauth_init_failed`);
  }

  const response = NextResponse.redirect(data.url);
  captured.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}
