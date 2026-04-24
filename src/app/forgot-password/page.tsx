'use client';
// src/app/forgot-password/page.tsx

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

const linkStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  color: 'var(--accent)',
  letterSpacing: '0.04em',
};

const buttonStyle: React.CSSProperties = {
  width: '100%',
  justifyContent: 'center',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.15)',
  color: 'var(--text)',
  fontFamily: 'var(--font-mono)',
  fontSize: 13,
  fontWeight: 600,
  padding: '12px 16px',
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    const supabase = createClient();
    // Intentionally ignore error so the success state doesn't leak whether
    // the email exists. Errors are still surfaced via Supabase logs.
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setSubmitted(true);
    setSubmitting(false);
  }

  return (
    <main className="auth-page">
      <div className="auth-form card" style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tbl-logo.png" alt="TBL" style={{ width: 56, height: 56, objectFit: 'contain', margin: '0 auto 16px' }} />
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 6 }}>
            Reset password
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            We&apos;ll email you a link
          </p>
        </div>

        {submitted ? (
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)', marginBottom: 8 }}>
              Check your email.
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              If an account exists for that address, we just sent a link to reset your password.
            </p>
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <Link href="/login" style={linkStyle}>Back to sign in</Link>
            </div>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
              <input
                type="email"
                autoComplete="email"
                required
                placeholder="Email"
                className="auth-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
              <button
                type="submit"
                disabled={submitting || !email}
                className="btn"
                style={{ ...buttonStyle, opacity: submitting ? 0.7 : 1, marginTop: 4 }}
              >
                {submitting ? 'Sending…' : 'Send reset link'}
              </button>
            </form>

            <div style={{ marginTop: 20 }}>
              <Link href="/login" style={linkStyle}>Back to sign in</Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
