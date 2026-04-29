'use client';
// src/app/admin/analytics/AnalyticsClient.tsx
// In-app analytics dashboard. Gated by ANALYTICS_SECRET (validated against
// /api/admin/verify-analytics on submit). After auth, fetches aggregated
// pageview stats from /api/admin/analytics/summary and renders them with
// pure-CSS bars to keep the bundle small and on-brand.

import { useCallback, useEffect, useState } from 'react';

type Range = '7d' | '30d' | '90d' | 'all';

interface Summary {
  range: Range;
  totalVisits: number;
  uniqueVisitors: number;
  visitsByDay: { date: string; count: number }[];
  topCountries: { name: string; count: number }[];
  topCities: { name: string; country: string | null; count: number }[];
  topPages: { path: string; count: number }[];
  topVisitors: { code: string; count: number; lastSeen: string; country: string | null }[];
  capped: boolean;
}

const RANGES: { id: Range; label: string }[] = [
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
  { id: 'all', label: 'All' },
];

export function AnalyticsClient({
  vercelUrl,
  gaUrl,
}: {
  vercelUrl: string;
  gaUrl: string;
}) {
  const [secret, setSecret] = useState('');
  const [authedSecret, setAuthedSecret] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [range, setRange] = useState<Range>('30d');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!secret.trim()) return;
    setSubmitting(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/admin/verify-analytics', {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}` },
      });
      if (res.ok) {
        setAuthedSecret(secret);
      } else {
        const json = await res.json().catch(() => ({}));
        setAuthError(json.error ?? `Unauthorized (${res.status})`);
      }
    } catch {
      setAuthError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  const loadSummary = useCallback(
    async (s: string, r: Range) => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`/api/admin/analytics/summary?range=${r}`, {
          headers: { Authorization: `Bearer ${s}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setLoadError(json.error ?? `Failed (${res.status})`);
          return;
        }
        setSummary(json as Summary);
      } catch {
        setLoadError('Network error');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (authedSecret) loadSummary(authedSecret, range);
  }, [authedSecret, range, loadSummary]);

  if (!authedSecret) {
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
            {authError && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--result-l)', marginTop: 4 }}>
                {authError}
              </p>
            )}
          </form>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="page container" style={{ maxWidth: 960 }}>
        <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1>Site Analytics</h1>
            <p className="subtitle">Visitor counts, geography, top pages</p>
          </div>
          <RangePicker range={range} onChange={setRange} />
        </div>

        {loadError && (
          <div className="card" style={{ padding: 16, marginBottom: 16, borderColor: 'var(--result-l)' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--result-l)' }}>
              {loadError}{' '}
              <button
                type="button"
                onClick={() => loadSummary(authedSecret, range)}
                style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, marginLeft: 8, textDecoration: 'underline' }}
              >
                Retry
              </button>
            </p>
          </div>
        )}

        {!summary && loading && (
          <div className="card" style={{ padding: 32, textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>Loading…</p>
          </div>
        )}

        {summary && (
          <Dashboard summary={summary} loading={loading} />
        )}

        <ExternalLinks vercelUrl={vercelUrl} gaUrl={gaUrl} />
      </div>
    </main>
  );
}

function RangePicker({ range, onChange }: { range: Range; onChange: (r: Range) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: 4, border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
      {RANGES.map((r) => {
        const active = range === r.id;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onChange(r.id)}
            style={{
              padding: '6px 12px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              borderRadius: 'calc(var(--radius) - 2px)',
              border: 'none',
              background: active ? 'var(--accent)' : 'transparent',
              color: active ? 'var(--accent-fg, #fff)' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

function Dashboard({ summary, loading }: { summary: Summary; loading: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: loading ? 0.6 : 1, transition: 'opacity 150ms' }}>
      <HeroStats summary={summary} />
      <DailyChart series={summary.visitsByDay} />
      <div className="analytics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <RankedList
          title="Top countries"
          rows={summary.topCountries.map((r) => ({ label: r.name, count: r.count }))}
          empty="No country data yet — Vercel only adds geo headers in production."
        />
        <RankedList
          title="Top cities"
          rows={summary.topCities.map((r) => ({
            label: r.country ? `${r.name}, ${r.country}` : r.name,
            count: r.count,
          }))}
          empty="No city data yet."
        />
        <RankedList
          title="Top pages"
          rows={summary.topPages.map((r) => ({ label: r.path, count: r.count, mono: true }))}
          empty="No pageviews yet."
        />
        <RankedList
          title="Most active visitors"
          rows={summary.topVisitors.map((r) => ({
            label: r.code,
            mono: true,
            count: r.count,
            sub: [r.country, relativeTime(r.lastSeen)].filter(Boolean).join(' · '),
          }))}
          empty="No visitor data yet."
        />
      </div>
      {summary.capped && (
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textAlign: 'right' }}>
          Showing the most recent 50,000 pageviews in this range.
        </p>
      )}
    </div>
  );
}

function HeroStats({ summary }: { summary: Summary }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
      <BigStat label="Pageviews" value={summary.totalVisits} />
      <BigStat label="Unique visitors" value={summary.uniqueVisitors} />
    </div>
  );
}

function BigStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card" style={{ padding: '20px 24px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 700, color: 'var(--text-heading)', lineHeight: 1 }}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function DailyChart({ series }: { series: { date: string; count: number }[] }) {
  const max = Math.max(1, ...series.map((s) => s.count));
  const labelEvery = series.length <= 7 ? 1 : series.length <= 30 ? 7 : 14;
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
        Visits over time
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120, borderBottom: '1px solid var(--border)' }}>
        {series.map((s, i) => {
          const h = (s.count / max) * 100;
          return (
            <div
              key={s.date + i}
              title={`${s.date}: ${s.count}`}
              style={{
                flex: 1,
                background: s.count > 0 ? 'var(--accent)' : 'var(--border)',
                height: `${Math.max(h, s.count > 0 ? 2 : 1)}%`,
                minHeight: 1,
                borderRadius: '2px 2px 0 0',
                transition: 'height 200ms',
              }}
            />
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
        {series.map((s, i) => (
          <div
            key={s.date + i}
            style={{
              flex: 1,
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--text-muted)',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {i % labelEvery === 0 ? s.date.slice(5) : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

interface RankedRow {
  label: string;
  count: number;
  sub?: string;
  mono?: boolean;
}
function RankedList({ title, rows, empty }: { title: string; rows: RankedRow[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
        {title}
      </div>
      {rows.length === 0 ? (
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{empty}</p>
      ) : (
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r, i) => {
            const pct = (r.count / max) * 100;
            return (
              <li key={`${r.label}-${i}`} style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'var(--accent)',
                  opacity: 0.12,
                  width: `${pct}%`,
                  borderRadius: 4,
                }} />
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 8px', minHeight: 28 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        fontFamily: r.mono ? 'var(--font-mono)' : undefined,
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.label}
                    </span>
                    {r.sub && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                        {r.sub}
                      </span>
                    )}
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text-heading)' }}>
                    {r.count.toLocaleString()}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function ExternalLinks({ vercelUrl, gaUrl }: { vercelUrl: string; gaUrl: string }) {
  const linkStyle: React.CSSProperties = {
    flex: 1,
    padding: '12px 16px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    textDecoration: 'none',
    textAlign: 'center',
  };
  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
        External dashboards
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a href={vercelUrl} target="_blank" rel="noopener noreferrer" style={linkStyle}>
          Vercel Web Analytics ↗
        </a>
        <a href={gaUrl} target="_blank" rel="noopener noreferrer" style={linkStyle}>
          Google Analytics ↗
        </a>
      </div>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 12, textAlign: 'center' }}>
        GA tracking ID: <code>G-2G5HV9RKGS</code>
      </p>
    </div>
  );
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}

