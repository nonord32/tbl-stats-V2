// src/app/api/auth/google/route.ts
// Server-initiated Google OAuth.
//
// Uses the official Supabase Next.js pattern: a route-handler-scoped
// supabase client backed by next/headers cookies(). signInWithOAuth will
// write the PKCE code_verifier cookie via that handle, and Next.js
// attaches it to whatever response the handler returns. iOS Safari's
// tracking prevention drops cookies set via document.cookie from the
// browser-side flow, so we run signInWithOAuth on the server instead.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { origin } = new URL(request.url);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error || !data?.url) {
    return NextResponse.redirect(`${origin}/login?error=oauth_init_failed`);
  }

  return NextResponse.redirect(data.url);
}
