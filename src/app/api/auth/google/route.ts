// src/app/api/auth/google/route.ts
// Server-initiated Google OAuth.
//
// supabase.auth.signInWithOAuth on the browser stores the PKCE code_verifier
// via document.cookie, which iOS Safari's tracking prevention can drop
// before the OAuth round trip completes. We capture every cookie supabase
// asks us to set (including the verifier) and replay them onto the final
// 302 redirect to Google as real Set-Cookie headers — those Safari has
// to honor on a top-level navigation.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
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

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error || !data?.url) {
    return NextResponse.redirect(`${origin}/login?error=oauth_init_failed`);
  }

  const response = NextResponse.redirect(data.url);
  captured.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}
