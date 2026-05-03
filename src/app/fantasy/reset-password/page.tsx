'use client';
// src/app/fantasy/reset-password/page.tsx
// V2 dark password-reset destination. /auth/callback exchanges the
// recovery code for a session and forwards here, so the user is signed
// in by the time this renders. After updating their password they go
// back to the fantasy lobby.

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type SessionState = 'checking' | 'valid' | 'missing';

export default function FantasyResetPasswordPage() {
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
    router.push('/fantasy');
    router.refresh();
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
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
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
            New password
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
            Choose something memorable
          </p>
        </div>

        {sessionState === 'checking' && (
          <p
            style={{
              fontFamily: 'var(--fv2-font-mono)',
              fontSize: 12,
              color: 'var(--fv2-text-3)',
            }}
          >
            Loading…
          </p>
        )}

        {sessionState === 'missing' && (
          <div style={{ textAlign: 'left' }}>
            <p
              style={{
                fontFamily: 'var(--fv2-font-mono)',
                fontSize: 13,
                color: 'var(--fv2-text-1)',
                marginBottom: 8,
              }}
            >
              This reset link is invalid or expired.
            </p>
            <p
              style={{
                fontFamily: 'var(--fv2-font-mono)',
                fontSize: 12,
                color: 'var(--fv2-text-3)',
                lineHeight: 1.5,
              }}
            >
              Reset links are single-use and expire after a short window.
              Request a new one to continue.
            </p>
            <div style={{ marginTop: 22, textAlign: 'center' }}>
              <Link
                href="/fantasy/forgot-password"
                className="fv2-link"
                style={{
                  fontFamily: 'var(--fv2-font-mono)',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                }}
              >
                Request a new link
              </Link>
            </div>
          </div>
        )}

        {sessionState === 'valid' && (
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}
          >
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              placeholder="New password"
              className="fv2-input"
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
              className="fv2-input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
              disabled={submitting || !password || !confirm}
              className="fv2-btn fv2-btn--primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '12px 16px',
                marginTop: 4,
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
