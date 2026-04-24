'use client';
// src/app/reset-password/page.tsx
// Lands here after clicking the password-reset email link. The /auth/callback
// route exchanges the recovery code for a session, then forwards here, so the
// user is signed in by the time this renders.

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

type SessionState = 'checking' | 'valid' | 'missing';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [sessionState, setSessionState] = useState<SessionState>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data, error: getUserError }) => {
      if (getUserError || !data?.user) {
        setSessionState('missing');
      } else {
        setSessionState('valid');
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || !confirm) return;
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }
    router.push('/picks');
    router.refresh();
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div className="auth-form card" style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tbl-logo.png" alt="TBL" style={{ width: 56, height: 56, objectFit: 'contain', margin: '0 auto 16px' }} />
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 6 }}>
            New password
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Choose something memorable
          </p>
        </div>

        {sessionState === 'checking' && (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
            Loading…
          </p>
        )}

        {sessionState === 'missing' && (
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)', marginBottom: 8 }}>
              This reset link is invalid or expired.
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Reset links are single-use and expire after a short window. Request a new one to continue.
            </p>
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <Link href="/forgot-password" style={linkStyle}>Request a new link</Link>
            </div>
          </div>
        )}

        {sessionState === 'valid' && (
          <>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                placeholder="New password"
                className="auth-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                placeholder="Confirm new password"
                className="auth-input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={submitting}
              />
              {error && (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--result-l)', margin: 0 }}>
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting || !password || !confirm}
                className="btn"
                style={{ ...buttonStyle, opacity: submitting ? 0.7 : 1, marginTop: 4 }}
              >
                {submitting ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
