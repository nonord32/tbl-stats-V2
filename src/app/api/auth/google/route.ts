// src/app/api/auth/google/route.ts
// Server-initiated Google OAuth.
//
// We previously called supabase.auth.signInWithOAuth on the browser client,
// which stores the PKCE code_verifier via document.cookie. iOS Safari's
// tracking prevention can drop that JS-set cookie before the OAuth round
// trip completes, so the /auth/callback exchange fails and the user lands
// back on /login (which on a phone reads as "home"). Doing the kickoff
// here lets us set the code_verifier as a real Set-Cookie header on a 302
// the browser must follow.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);

  // Placeholder response we will overwrite once Supabase tells us the URL.
  // Cookies set by the supabase client during signInWithOAuth (PKCE
  // code_verifier) are written directly onto this response.
  const carrier = NextResponse.redirect(`${origin}/login?error=oauth_init_failed`);

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
            carrier.cookies.set(name, value, options);
          });
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

  // Build the real redirect to Google's auth URL, carrying the cookies that
  // the supabase library asked us to set (notably the PKCE verifier).
  const response = NextResponse.redirect(data.url);
  carrier.cookies.getAll().forEach((c) => {
    response.cookies.set(c.name, c.value, c);
  });
  return response;
}
