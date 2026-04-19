'use client';
// src/app/admin/AdminClient.tsx

import { useState } from 'react';

interface MatchEntry {
  matchIndex: number;
  week: number | string;
  date: string;
  team1: string;
  team2: string;
  status: string;
  hasResult: boolean;
  score1: number | null;
  score2: number | null;
  winner: string | null;
}

interface PickRow {
  matchIndex: number;
  matchLabel: string;
  displayName: string;
  username: string;
  pickedTeam: string;
  diffBand: string;
  pointsEarned: number;
  resolved: boolean;
}

interface ResolveResult {
  message: string;
  resolved: number;
  actualWinner?: string;
  actualBand?: string;
  diff?: number;
  error?: string;
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
    });
  } catch { return dateStr; }
}

export function AdminClient({ matches, picks }: { matches: MatchEntry[]; picks: PickRow[] }) {
  const [secret, setSecret] = useState('');
  const [authed, setAuthed] = useState(false);
  const [resolving, setResolving] = useState<number | null>(null);
  const [results, setResults] = useState<Record<number, ResolveResult>>({});

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (secret.trim()) setAuthed(true);
  }

  async function handleResolve(matchIndex: number) {
    setResolving(matchIndex);
    try {
      const res = await fetch('/api/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secret}`,
        },
        body: JSON.stringify({ match_index: matchIndex }),
      });
      const json: ResolveResult = await res.json();
      setResults((prev) => ({ ...prev, [matchIndex]: json }));
    } catch {
      setResults((prev) => ({ ...prev, [matchIndex]: { message: '', resolved: 0, error: 'Network error' } }));
    } finally {
      setResolving(null);
    }
  }

  if (!authed) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="card" style={{ width: '100%', maxWidth: 360, padding: 32 }}>
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4 }}>
            Admin
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 24, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Resolve Pick&apos;em Results
          </p>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="password"
              placeholder="Admin secret"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="auth-input"
              autoFocus
            />
            <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center' }}>
              Enter
            </button>
          </form>
        </div>
      </main>
    );
  }

  const resolvable = matches.filter((m) => m.hasResult);
  const upcoming = matches.filter((m) => !m.hasResult);

  return (
    <main>
      <div className="page container" style={{ maxWidth: 760 }}>
        <div className="page-header">
          <div>
            <h1>Admin — Resolve Picks</h1>
            <p className="subtitle">Score everyone&apos;s picks after a match is completed</p>
          </div>
        </div>

        {/* Matches with results — resolvable */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>
            Completed Matches
          </h2>

          {resolvable.length === 0 && (
            <div className="card" style={{ padding: 24 }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>
                No completed matches found in the sheet yet.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {resolvable.map((m) => {
              const result = results[m.matchIndex];
              const isResolving = resolving === m.matchIndex;
              const diff = m.score1 !== null && m.score2 !== null ? Math.abs(m.score1 - m.score2) : null;

              return (
                <div key={m.matchIndex} className="card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                          Wk {m.week} · {formatDate(m.date)}
                        </span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--text-heading)' }}>
                        {m.team1} vs {m.team2}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                        Winner: <span style={{ color: 'var(--result-w)', fontWeight: 700 }}>{m.winner}</span>
                        {diff !== null && (
                          <span style={{ marginLeft: 12 }}>
                            Margin: <span style={{ color: 'var(--text)' }}>{diff} pts</span>
                          </span>
                        )}
                        {m.score1 !== null && (
                          <span style={{ marginLeft: 12, color: 'var(--text-muted)' }}>
                            ({m.score1}–{m.score2})
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {result && !result.error && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--result-w)' }}>
                          ✓ {result.resolved} picks resolved
                        </span>
                      )}
                      {result?.error && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--result-l)' }}>
                          {result.error}
                        </span>
                      )}
                      <button
                        onClick={() => handleResolve(m.matchIndex)}
                        disabled={isResolving}
                        className="btn btn-primary"
                        style={{ opacity: isResolving ? 0.6 : 1, whiteSpace: 'nowrap' }}
                      >
                        {isResolving ? 'Resolving…' : result ? 'Re-resolve' : 'Resolve Picks'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Upcoming — not yet resolvable */}
        {upcoming.length > 0 && (
          <section>
            <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>
              Upcoming (no result yet)
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {upcoming.map((m) => (
                <div key={m.matchIndex} className="card" style={{ padding: '12px 16px', opacity: 0.5 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)' }}>
                    Wk {m.week} · {m.team1} vs {m.team2}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginLeft: 12 }}>
                    {formatDate(m.date)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* All picks table */}
        <section style={{ marginTop: 40 }}>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>
            All Picks ({picks.length})
          </h2>
          {picks.length === 0 ? (
            <div className="card" style={{ padding: 24 }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>No picks submitted yet.</p>
            </div>
          ) : (
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Match</th>
                      <th>Picked</th>
                      <th>Margin</th>
                      <th className="num-cell">Pts</th>
                      <th className="num-cell">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {picks.map((p, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600 }}>
                          {p.displayName || p.username || '—'}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                          {p.matchLabel}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                          {p.pickedTeam}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                          {p.diffBand}
                        </td>
                        <td className="num-cell" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: p.pointsEarned > 0 ? 'var(--result-w)' : 'var(--text-muted)' }}>
                          {p.resolved ? p.pointsEarned : '—'}
                        </td>
                        <td className="num-cell" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: p.resolved ? 'var(--result-w)' : 'var(--text-muted)' }}>
                          {p.resolved ? 'Scored' : 'Pending'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
