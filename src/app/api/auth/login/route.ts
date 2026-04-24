// src/app/api/auth/login/route.ts
// Server-side email + password sign-in. Browser-only signInWithPassword
// works on most desktop browsers but iOS Safari's tracking-prevention can
// drop JS-set cookies, leaving /picks redirecting back to /login. Doing
// the exchange here lets the server set Set-Cookie headers on the response
// that the browser must honor.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const email = body.email?.trim();
  const password = body.password;
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
