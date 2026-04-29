'use client';
// src/app/admin/analytics/AnalyticsClient.tsx

import { useState } from 'react';

export function AnalyticsClient({
  vercelUrl,
  gaUrl,
}: {
  vercelUrl: string;
  gaUrl: string;
}) {
  const [secret, setSecret] = useState('');
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!secret.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/verify-analytics', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
        },
      });
      if (res.ok) {
        setAuthed(true);
      } else {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? `Unauthorized (${res.status})`);
      }
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  if (!authed) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="card" style={{ width: '100%', maxWidth: 360, padding: 32 }}>
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4 }}>
            Analytics
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 24, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Visitor stats &amp; traffic
          </p>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="password"
              placeholder="Analytics secret"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="auth-input"
              autoFocus
              disabled={submitting}
            />
            <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', opacity: submitting ? 0.6 : 1 }} disabled={submitting}>
              {submitting ? 'Checking…' : 'Enter'}
            </button>
            {error && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--result-l)', marginTop: 4 }}>
                {error}
              </p>
            )}
          </form>
        </div>
      </main>
    );
  }

  const buttonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '20px 24px',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text)',
    textDecoration: 'none',
    fontFamily: 'var(--font-mono)',
  };

  return (
    <main>
      <div className="page container" style={{ maxWidth: 760 }}>
        <div className="page-header">
          <div>
            <h1>Site Analytics</h1>
            <p className="subtitle">Visitor counts, geography, devices &amp; performance</p>
          </div>
        </div>

        <div className="card" style={{ padding: 20, marginBottom: 24 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Visitor data is collected automatically by <strong>Vercel Web Analytics</strong> and{' '}
            <strong>Google Analytics</strong>. Both capture pageviews, sessions, country, city,
            device, and referrer with no extra setup. Open either dashboard below.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <a
            href={vercelUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={buttonStyle}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4 }}>
                Vercel Web Analytics
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Pageviews · top pages · countries · devices
              </div>
            </div>
            <span style={{ fontSize: 18, color: 'var(--text-muted)' }}>→</span>
          </a>

          <a
            href={gaUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={buttonStyle}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4 }}>
                Google Analytics
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Realtime · acquisition · cities · retention
              </div>
            </div>
            <span style={{ fontSize: 18, color: 'var(--text-muted)' }}>→</span>
          </a>
        </div>

        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginTop: 24, textAlign: 'center' }}>
          GA tracking ID: <code>G-2G5HV9RKGS</code>
        </p>
      </div>
    </main>
  );
}
