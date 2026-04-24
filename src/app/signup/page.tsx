'use client';
// src/app/signup/page.tsx

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

export default function SignupPage() {
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
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/picks`,
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
    <main className="auth-page">
      <div className="auth-form card" style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tbl-logo.png" alt="TBL" style={{ width: 56, height: 56, objectFit: 'contain', margin: '0 auto 16px' }} />
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 6 }}>
            Create account
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            TBL Pick&apos;em · 2026
          </p>
        </div>

        {submittedEmail ? (
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)', marginBottom: 8 }}>
              Check your email.
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              We sent a confirmation link to <strong style={{ color: 'var(--text)' }}>{submittedEmail}</strong>.
              Click it to finish creating your account.
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
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                placeholder="Password (min 6 characters)"
                className="auth-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
              {error && (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--result-l)', margin: 0 }}>
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting || !email || !password}
                className="btn"
                style={{ ...buttonStyle, opacity: submitting ? 0.7 : 1, marginTop: 4 }}
              >
                {submitting ? 'Creating account…' : 'Create account'}
              </button>
            </form>

            <div style={{ marginTop: 20 }}>
              <Link href="/login" style={linkStyle}>Already have an account? Sign in</Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
