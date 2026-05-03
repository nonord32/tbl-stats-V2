'use client';
// src/app/fantasy/login/page.tsx
// V2 dark sign-in for the fantasy section. Same auth backends as /login
// (POST /api/auth/login, GET /api/auth/google) — those routes now honor
// a `next` parameter so post-auth lands the user back on the fantasy
// page they were trying to reach.
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const DEFAULT_NEXT = '/fantasy';

function safeNextPath(raw: string | null): string {
  if (!raw) return DEFAULT_NEXT;
  if (!raw.startsWith('/')) return DEFAULT_NEXT;
  if (raw.startsWith('//')) return DEFAULT_NEXT;
  return raw;
}

function FantasyLoginForm() {
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));

  const [submitting, setSubmitting] = useState(false);
  const [redirectingGoogle, setRedirectingGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('error');
    if (!code) return;
    if (code === 'auth_callback_failed') setError('Sign-in failed. Try again.');
    else if (code === 'oauth_init_failed') setError('Could not start Google sign-in. Try again.');
    else setError(decodeURIComponent(code));
  }, [searchParams]);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
      }}
    >
      <div
        className="fv2-card"
        style={{
          width: '100%',
          maxWidth: 400,
          padding: 32,
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: '0 auto 18px',
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background:
                'linear-gradient(135deg, var(--fv2-accent) 0%, var(--fv2-accent-bright) 100%)',
              boxShadow: '0 6px 22px rgba(139, 92, 246, 0.4)',
            }}
            aria-hidden
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12l3 3 5-6" />
            </svg>
          </div>
          <h1
            style={{
              fontFamily: 'var(--fv2-font-mono)',
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--fv2-text-1)',
              letterSpacing: '-0.01em',
              margin: 0,
            }}
          >
            TBL Fantasy
          </h1>
          <p
            style={{
              marginTop: 8,
              fontFamily: 'var(--fv2-font-mono)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--fv2-accent-bright)',
            }}
          >
            2026 Season
          </p>
        </div>

        <a
          href={`/api/auth/google?next=${encodeURIComponent(next)}`}
          onClick={() => setRedirectingGoogle(true)}
          aria-disabled={redirectingGoogle || submitting}
          className="fv2-btn"
          style={{
            width: '100%',
            justifyContent: 'center',
            gap: 10,
            padding: '12px 16px',
            opacity: redirectingGoogle ? 0.7 : 1,
            marginBottom: 18,
            pointerEvents: redirectingGoogle || submitting ? 'none' : 'auto',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          {redirectingGoogle ? 'Redirecting…' : 'Sign in with Google'}
        </a>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
            fontFamily: 'var(--fv2-font-mono)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--fv2-text-3)',
          }}
        >
          <div style={{ flex: 1, height: 1, background: 'var(--fv2-border)' }} />
          or
          <div style={{ flex: 1, height: 1, background: 'var(--fv2-border)' }} />
        </div>

        <form
          action="/api/auth/login"
          method="POST"
          onSubmit={() => setSubmitting(true)}
          style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}
        >
          <input type="hidden" name="next" value={next} />
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            placeholder="Email"
            className="fv2-input"
            disabled={submitting}
          />
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            placeholder="Password"
            className="fv2-input"
            disabled={submitting}
          />
          {error && (
            <p
              style={{
                fontFamily: 'var(--fv2-font-mono)',
                fontSize: 12,
                color: 'var(--fv2-negative)',
                margin: 0,
              }}
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="fv2-btn fv2-btn--primary"
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '12px 16px',
              marginTop: 4,
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div
          style={{
            marginTop: 22,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <Link
            href={`/signup?next=${encodeURIComponent(next)}`}
            className="fv2-link"
            style={{
              fontFamily: 'var(--fv2-font-mono)',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.04em',
            }}
          >
            Create account
          </Link>
          <Link
            href="/forgot-password"
            className="fv2-link"
            style={{
              fontFamily: 'var(--fv2-font-mono)',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.04em',
            }}
          >
            Forgot password?
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function FantasyLoginPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />
      }
    >
      <FantasyLoginForm />
    </Suspense>
  );
}
