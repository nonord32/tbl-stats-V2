'use client';
// src/app/fantasy/signup/page.tsx
// V2 dark account creation. Mirrors /signup but stays inside the
// fantasy visual world: hidden chrome, violet accent, mono UI.
// emailRedirectTo lands the user back on the fantasy lobby after they
// confirm their email.
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const DEFAULT_NEXT = '/fantasy';

function safeNextPath(raw: string | null): string {
  if (!raw) return DEFAULT_NEXT;
  if (!raw.startsWith('/')) return DEFAULT_NEXT;
  if (raw.startsWith('//')) return DEFAULT_NEXT;
  return raw;
}

function FantasySignupForm() {
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (signUpError) {
      setError(signUpError.message);
      setSubmitting(false);
      return;
    }
    // Supabase returns a fake user with identities: [] when the email is
    // already registered (anti-enumeration). No email is sent in that case.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError('An account with this email already exists. Try signing in instead.');
      setSubmitting(false);
      return;
    }
    setSubmittedEmail(email.trim());
    setSubmitting(false);
  }

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
        style={{ width: '100%', maxWidth: 400, padding: 32, textAlign: 'center' }}
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
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M19 8v6M22 11h-6" />
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
            Create account
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
            TBL Fantasy · 2026
          </p>
        </div>

        {submittedEmail ? (
          <div style={{ textAlign: 'left' }}>
            <p
              style={{
                fontFamily: 'var(--fv2-font-mono)',
                fontSize: 13,
                color: 'var(--fv2-text-1)',
                marginBottom: 8,
              }}
            >
              Check your email.
            </p>
            <p
              style={{
                fontFamily: 'var(--fv2-font-mono)',
                fontSize: 12,
                color: 'var(--fv2-text-3)',
                lineHeight: 1.5,
              }}
            >
              We sent a confirmation link to{' '}
              <strong style={{ color: 'var(--fv2-text-1)' }}>{submittedEmail}</strong>.
              Click it to finish creating your account.
            </p>
            <div style={{ marginTop: 22, textAlign: 'center' }}>
              <Link
                href={`/fantasy/login?next=${encodeURIComponent(next)}`}
                className="fv2-link"
                style={{
                  fontFamily: 'var(--fv2-font-mono)',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                }}
              >
                Back to sign in
              </Link>
            </div>
          </div>
        ) : (
          <>
            <form
              onSubmit={handleSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}
            >
              <input
                type="email"
                autoComplete="email"
                required
                placeholder="Email"
                className="fv2-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                placeholder="Password (min 6 characters)"
                className="fv2-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                disabled={submitting || !email || !password}
                className="fv2-btn fv2-btn--primary"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '12px 16px',
                  marginTop: 4,
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? 'Creating account…' : 'Create account'}
              </button>
            </form>

            <div style={{ marginTop: 22 }}>
              <Link
                href={`/fantasy/login?next=${encodeURIComponent(next)}`}
                className="fv2-link"
                style={{
                  fontFamily: 'var(--fv2-font-mono)',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                }}
              >
                Already have an account? Sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function FantasySignupPage() {
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
      <FantasySignupForm />
    </Suspense>
  );
}
