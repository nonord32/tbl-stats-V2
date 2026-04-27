'use client';
// src/app/admin/AdminClient.tsx

import { useMemo, useState } from 'react';

interface MatchEntry {
  matchIndex: number;
  week: number | string;
  date: string;
  team1: string;
  team2: string;
  status: string;
  hasResult: boolean;
  isCompleted: boolean;
  score1: number | null;
  score2: number | null;
  winner: string | null;
}

interface PickRow {
  userId: string;
  matchIndex: number;
  matchLabel: string;
  displayName: string;
  username: string;
  pickedTeam: string;
  diffBand: string;
  pointsEarned: number | null;
  resolved: boolean;
}

interface ResolveResult {
  message: string;
  resolved: number;
  changed?: number;
  actualWinner?: string;
  actualBand?: string;
  diff?: number;
  error?: string;
}

interface UnresolveResult {
  message: string;
  unresolved: number;
  error?: string;
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
    });
  } catch { return dateStr; }
}

interface DbDebug {
  picksCount: number;
  picksError: string | null;
  profilesCount: number;
  profilesError: string | null;
  serviceKeySet: boolean;
}

export function AdminClient({ matches, picks: initialPicks, dbError, dbDebug }: { matches: MatchEntry[]; picks: PickRow[]; dbError: string | null; dbDebug: DbDebug }) {
  const [secret, setSecret] = useState('');
  const [authed, setAuthed] = useState(false);
  const [resolving, setResolving] = useState<number | null>(null);
  const [results, setResults] = useState<Record<number, ResolveResult>>({});
  const [unresolving, setUnresolving] = useState<number | null>(null);
  const [unresolveResults, setUnresolveResults] = useState<Record<number, UnresolveResult>>({});

  // Fantasy resolution state — separate from picks resolution.
  const [fantasyWeek, setFantasyWeek] = useState<string>('');
  const [fantasyResolving, setFantasyResolving] = useState(false);
  const [fantasyResult, setFantasyResult] = useState<{
    message?: string;
    resolved?: number;
    total?: number;
    week?: number;
    error?: string;
  } | null>(null);

  async function handleResolveFantasy() {
    const weekNum = Number(fantasyWeek);
    if (!Number.isFinite(weekNum) || weekNum <= 0) {
      setFantasyResult({ error: 'Enter a positive week number' });
      return;
    }
    setFantasyResolving(true);
    setFantasyResult(null);
    try {
      const res = await fetch('/api/fantasy/score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ week: weekNum }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFantasyResult({ error: json.error ?? `Failed (${res.status})` });
      } else {
        setFantasyResult(json);
      }
    } catch {
      setFantasyResult({ error: 'Network error' });
    } finally {
      setFantasyResolving(false);
    }
  }

  // Local copy of picks so deletions update the table without a page reload.
  // Keyed by `${userId}:${matchIndex}` since that's our composite identity.
  const [picks, setPicks] = useState<PickRow[]>(initialPicks);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Picks table filters
  const [userFilter, setUserFilter] = useState('');
  const [matchFilter, setMatchFilter] = useState('');
  const [pickedFilter, setPickedFilter] = useState('');
  const [marginFilter, setMarginFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const uniqueMatches = useMemo(
    () => Array.from(new Set(picks.map((p) => p.matchLabel))).sort(),
    [picks]
  );
  const uniqueTeams = useMemo(
    () => Array.from(new Set(picks.map((p) => p.pickedTeam).filter(Boolean))).sort(),
    [picks]
  );
  const uniqueMargins = useMemo(
    () => Array.from(new Set(picks.map((p) => p.diffBand).filter(Boolean))).sort(),
    [picks]
  );

  const filteredPicks = useMemo(() => {
    const q = userFilter.trim().toLowerCase();
    return picks.filter((p) => {
      if (q) {
        const name = (p.displayName || p.username || '').toLowerCase();
        if (!name.includes(q)) return false;
      }
      if (matchFilter && p.matchLabel !== matchFilter) return false;
      if (pickedFilter && p.pickedTeam !== pickedFilter) return false;
      if (marginFilter && p.diffBand !== marginFilter) return false;
      if (statusFilter === 'scored' && !p.resolved) return false;
      if (statusFilter === 'pending' && p.resolved) return false;
      return true;
    });
  }, [picks, userFilter, matchFilter, pickedFilter, marginFilter, statusFilter]);

  const hasActiveFilter =
    !!(userFilter || matchFilter || pickedFilter || marginFilter || statusFilter);

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
      if (res.ok) {
        // Reflect resolved state in the table so the Unresolve button shows
        // up immediately. Points for individual rows still need a refresh
        // since the API response only carries the aggregate count.
        setPicks((prev) =>
          prev.map((row) =>
            row.matchIndex === matchIndex && !row.resolved
              ? { ...row, resolved: true }
              : row
          )
        );
      }
    } catch {
      setResults((prev) => ({ ...prev, [matchIndex]: { message: '', resolved: 0, error: 'Network error' } }));
    } finally {
      setResolving(null);
    }
  }

  async function handleUnresolve(matchIndex: number) {
    if (!confirm(`Unresolve all picks for match ${matchIndex}? Points and results will be cleared so the match can be re-resolved.`)) {
      return;
    }
    setUnresolving(matchIndex);
    try {
      const res = await fetch('/api/admin/unresolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secret}`,
        },
        body: JSON.stringify({ match_index: matchIndex }),
      });
      const json: UnresolveResult = await res.json();
      setUnresolveResults((prev) => ({ ...prev, [matchIndex]: json }));
      if (res.ok) {
        // Clear the prior resolve banner so the UI doesn't show stale "X resolved".
        setResults((prev) => {
          const next = { ...prev };
          delete next[matchIndex];
          return next;
        });
        setPicks((prev) =>
          prev.map((row) =>
            row.matchIndex === matchIndex
              ? { ...row, resolved: false, pointsEarned: null }
              : row
          )
        );
      }
    } catch {
      setUnresolveResults((prev) => ({ ...prev, [matchIndex]: { message: '', unresolved: 0, error: 'Network error' } }));
    } finally {
      setUnresolving(null);
    }
  }

  async function handleDeletePick(p: PickRow) {
    const label = p.displayName || p.username || 'this user';
    if (!confirm(`Delete ${label}'s pick on ${p.matchLabel}? This can't be undone.`)) {
      return;
    }
    const key = `${p.userId}:${p.matchIndex}`;
    setDeleting(key);
    setDeleteError(null);
    try {
      const res = await fetch('/api/admin/delete-pick', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ user_id: p.userId, match_index: p.matchIndex }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(json.error || `Delete failed (${res.status})`);
        return;
      }
      setPicks((prev) =>
        prev.filter((row) => !(row.userId === p.userId && row.matchIndex === p.matchIndex))
      );
    } catch {
      setDeleteError('Network error while deleting pick.');
    } finally {
      setDeleting(null);
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

  const resolvable = matches.filter((m) => m.isCompleted);
  const upcoming = matches.filter((m) => !m.isCompleted);


  return (
    <main>
      <div className="page container" style={{ maxWidth: 760 }}>
        <div className="page-header">
          <div>
            <h1>Admin — Resolve Picks</h1>
            <p className="subtitle">Score everyone&apos;s picks after a match is completed</p>
          </div>
        </div>

        {/* DB debug info */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 20, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
          serviceKey: {dbDebug.serviceKeySet ? '✓ set' : '✗ MISSING'} ·
          picks in DB: {dbDebug.picksCount} ·
          picks prop: {picks.length} ·
          profiles in DB: {dbDebug.profilesCount}
          {dbDebug.picksError && <span style={{ color: 'var(--result-l)', marginLeft: 8 }}>picks err: {dbDebug.picksError}</span>}
          {dbDebug.profilesError && <span style={{ color: 'var(--result-l)', marginLeft: 8 }}>profiles err: {dbDebug.profilesError}</span>}
        </div>

        {/* DB error banner */}
        {dbError && (
          <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 24 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--result-l)' }}>
              DB error: {dbError}
            </p>
          </div>
        )}

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
              const unresolveResult = unresolveResults[m.matchIndex];
              const isResolving = resolving === m.matchIndex;
              const isUnresolving = unresolving === m.matchIndex;
              const hasResolvedPicks = picks.some((p) => p.matchIndex === m.matchIndex && p.resolved);
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
                        {m.hasResult ? (
                          <>
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
                          </>
                        ) : (
                          <span style={{ color: 'var(--result-l)' }}>
                            Marked completed in schedule but no result row in Data tab — add one to enable resolve.
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      {result && !result.error && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--result-w)' }}>
                          ✓ {result.resolved} picks resolved
                          {typeof result.changed === 'number' && result.changed !== result.resolved && (
                            <span style={{ color: 'var(--text-muted)' }}> ({result.changed} changed)</span>
                          )}
                        </span>
                      )}
                      {result?.error && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--result-l)' }}>
                          {result.error}
                        </span>
                      )}
                      {unresolveResult && !unresolveResult.error && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                          ↺ {unresolveResult.unresolved} picks unresolved
                        </span>
                      )}
                      {unresolveResult?.error && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--result-l)' }}>
                          {unresolveResult.error}
                        </span>
                      )}
                      {hasResolvedPicks && (
                        <button
                          onClick={() => handleUnresolve(m.matchIndex)}
                          disabled={isUnresolving || isResolving}
                          className="btn"
                          style={{
                            opacity: isUnresolving ? 0.6 : 1,
                            whiteSpace: 'nowrap',
                            background: 'transparent',
                            border: '1px solid var(--border)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {isUnresolving ? 'Unresolving…' : 'Unresolve'}
                        </button>
                      )}
                      <button
                        onClick={() => handleResolve(m.matchIndex)}
                        disabled={isResolving || isUnresolving || !m.hasResult}
                        className="btn btn-primary"
                        style={{ opacity: (isResolving || !m.hasResult) ? 0.6 : 1, whiteSpace: 'nowrap' }}
                        title={!m.hasResult ? 'Add a result row in the Data tab first.' : undefined}
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

        {/* Fantasy resolution */}
        <section style={{ marginTop: 40 }}>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>
            Resolve Fantasy
          </h2>
          <div className="card" style={{ padding: 16 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Walks every user&apos;s lineup for the chosen week, computes
              fantasy points from real fighter histories (Decision +1, KD +2,
              2KD +3, KO/TKO +4 / losses 0/-1/-2/-3), and writes the totals
              to <code>fantasy_weeks</code>. Idempotent — re-run after sheet
              corrections.
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="number"
                min={1}
                placeholder="Week #"
                value={fantasyWeek}
                onChange={(e) => setFantasyWeek(e.target.value)}
                className="auth-input"
                style={{ width: 120 }}
                disabled={fantasyResolving}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleResolveFantasy}
                disabled={fantasyResolving || !fantasyWeek}
                style={{ opacity: fantasyResolving ? 0.6 : 1 }}
              >
                {fantasyResolving ? 'Resolving…' : 'Resolve Fantasy'}
              </button>
              {fantasyResult && !fantasyResult.error && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--result-w)' }}>
                  ✓ {fantasyResult.message ?? `Resolved week ${fantasyResult.week}`}
                </span>
              )}
              {fantasyResult?.error && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--result-l)' }}>
                  ⚠ {fantasyResult.error}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* All picks table */}
        <section style={{ marginTop: 40 }}>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>
            All Picks ({hasActiveFilter ? `${filteredPicks.length} of ${picks.length}` : picks.length})
          </h2>
          {picks.length === 0 ? (
            <div className="card" style={{ padding: 24 }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>No picks submitted yet.</p>
            </div>
          ) : (
            <div className="card">
              <div className="card-header">
                <div className="filters">
                  <input
                    type="search"
                    className="filter-search"
                    placeholder="Search user…"
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    aria-label="Filter picks by user"
                  />
                  <select
                    className="filter-select"
                    value={matchFilter}
                    onChange={(e) => setMatchFilter(e.target.value)}
                    aria-label="Filter picks by match"
                  >
                    <option value="">All matches</option>
                    {uniqueMatches.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <select
                    className="filter-select"
                    value={pickedFilter}
                    onChange={(e) => setPickedFilter(e.target.value)}
                    aria-label="Filter picks by picked team"
                  >
                    <option value="">All teams</option>
                    {uniqueTeams.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <select
                    className="filter-select"
                    value={marginFilter}
                    onChange={(e) => setMarginFilter(e.target.value)}
                    aria-label="Filter picks by margin"
                  >
                    <option value="">All margins</option>
                    {uniqueMargins.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <select
                    className="filter-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    aria-label="Filter picks by status"
                  >
                    <option value="">All statuses</option>
                    <option value="scored">Scored</option>
                    <option value="pending">Pending</option>
                  </select>
                  {hasActiveFilter && (
                    <button
                      type="button"
                      onClick={() => {
                        setUserFilter('');
                        setMatchFilter('');
                        setPickedFilter('');
                        setMarginFilter('');
                        setStatusFilter('');
                      }}
                      className="filter-clear"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <div className="table-wrap">
                {deleteError && (
                  <div style={{ padding: '8px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--result-l)' }}>
                    {deleteError}
                  </div>
                )}
                <table>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Match</th>
                      <th>Picked</th>
                      <th>Margin</th>
                      <th className="num-cell">Pts</th>
                      <th className="num-cell">Status</th>
                      <th className="num-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPicks.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: 24, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                          No picks match the current filters.
                        </td>
                      </tr>
                    ) : (
                      filteredPicks.map((p) => {
                        const key = `${p.userId}:${p.matchIndex}`;
                        const isDeleting = deleting === key;
                        return (
                          <tr key={key}>
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
                            <td className="num-cell" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: (p.pointsEarned ?? 0) > 0 ? 'var(--result-w)' : 'var(--text-muted)' }}>
                              {p.resolved ? p.pointsEarned : '—'}
                            </td>
                            <td className="num-cell" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: p.resolved ? 'var(--result-w)' : 'var(--text-muted)' }}>
                              {p.resolved ? 'Scored' : 'Pending'}
                            </td>
                            <td className="num-cell">
                              <button
                                type="button"
                                onClick={() => handleDeletePick(p)}
                                disabled={isDeleting}
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  letterSpacing: '0.08em',
                                  textTransform: 'uppercase',
                                  color: 'var(--result-l)',
                                  background: 'transparent',
                                  border: '1px solid var(--result-l)',
                                  borderRadius: 'var(--radius)',
                                  padding: '4px 10px',
                                  cursor: isDeleting ? 'wait' : 'pointer',
                                  opacity: isDeleting ? 0.5 : 1,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {isDeleting ? 'Deleting…' : 'Delete'}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
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
