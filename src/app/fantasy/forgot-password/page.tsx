'use client';
// src/app/fantasy/forgot-password/page.tsx
// V2 dark password-reset request. Mirrors /forgot-password but the
// reset email points back to /fantasy/reset-password so the whole
// recovery flow stays in the fantasy visual world.
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function FantasyForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    const supabase = createClient();
    // Ignore errors so the success state doesn't leak whether the email
    // exists. Errors still surface in Supabase logs.
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/fantasy/reset-password`,
    });
    setSubmitted(true);
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
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <path d="m22 6-10 7L2 6" />
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
            Reset password
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
            We&apos;ll email you a link
          </p>
        </div>

        {submitted ? (
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
              If an account exists for that address, we just sent a link to
              reset your password.
            </p>
            <div style={{ marginTop: 22, textAlign: 'center' }}>
              <Link
                href="/fantasy/login"
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
              <button
                type="submit"
                disabled={submitting || !email}
                className="fv2-btn fv2-btn--primary"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '12px 16px',
                  marginTop: 4,
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? 'Sending…' : 'Send reset link'}
              </button>
            </form>

            <div style={{ marginTop: 22 }}>
              <Link
                href="/fantasy/login"
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
          </>
        )}
      </div>
    </main>
  );
}
