// src/app/api/auth/login/route.ts
// Server-side email + password sign-in. The login form posts here as a
// regular form submission so the browser performs a top-level navigation
// that follows the 302 redirect with the just-issued auth cookies attached.
// This is more iOS-Safari-friendly than the prior browser-fetch flow,
// which was having its cookies dropped by tracking prevention.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Only allow same-origin path redirects (no protocol-relative URLs, no
// open-redirect vectors). Falls back to /picks for any unsafe input.
function safeNextPath(raw: string | undefined | null): string {
  const fallback = '/picks';
  if (!raw) return fallback;
  if (!raw.startsWith('/')) return fallback;
  if (raw.startsWith('//')) return fallback;
  return raw;
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? '';
  let email: string | undefined;
  let password: string | undefined;
  let next: string | undefined;
  let wantsJson = false;

  if (contentType.includes('application/json')) {
    wantsJson = true;
    try {
      const body = (await request.json()) as { email?: string; password?: string; next?: string };
      email = body.email?.trim();
      password = body.password;
      next = body.next;
    } catch {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
  } else {
    const form = await request.formData();
    email = form.get('email')?.toString().trim();
    password = form.get('password')?.toString();
    next = form.get('next')?.toString();
  }

  const safeNext = safeNextPath(next);
  // Use the same login surface for the failure redirect so the user goes
  // back to where they came from (fantasy login vs site login).
  const loginPath = safeNext.startsWith('/fantasy') ? '/fantasy/login' : '/login';
  const failRedirect = (msg: string) =>
    NextResponse.redirect(
      new URL(
        `${loginPath}?error=${encodeURIComponent(msg)}&next=${encodeURIComponent(safeNext)}`,
        request.url
      ),
      { status: 303 }
    );

  if (!email || !password) {
    return wantsJson
      ? NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
      : failRedirect('Email and password are required');
  }

  // Build the success response up front so we can attach Set-Cookie headers
  // from the supabase setAll callback directly to it.
  const successRedirect = NextResponse.redirect(new URL(safeNext, request.url), { status: 303 });
  const okJson = NextResponse.json({ ok: true });
  const responseToCarryCookies = wantsJson ? okJson : successRedirect;

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
            responseToCarryCookies.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return wantsJson
      ? NextResponse.json({ error: error.message }, { status: 401 })
      : failRedirect(error.message);
  }

  return responseToCarryCookies;
}
