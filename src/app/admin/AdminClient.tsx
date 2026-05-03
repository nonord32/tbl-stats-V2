'use client';
// src/app/admin/AdminClient.tsx

import { useMemo, useState } from 'react';

interface MatchEntry {
  matchIndex: number;
  week: number | string;
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

  // Local copy of picks so deletions update the table without a page reload.
  // Keyed by `${userId}:${matchIndex}` since that's our composite identity.
  const [picks, setPicks] = useState<PickRow[]>(initialPicks);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Picks table filters
  const [userFilter, setUserFilter] = useState('');
  const [weekFilter, setWeekFilter] = useState('');
  const [matchFilter, setMatchFilter] = useState('');
  const [pickedFilter, setPickedFilter] = useState('');
  const [marginFilter, setMarginFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const matchIndexToWeek = useMemo(() => {
    const map = new Map<number, number | string>();
    for (const m of matches) {
      if (m.matchIndex !== undefined) map.set(m.matchIndex, m.week);
    }
    return map;
  }, [matches]);

  const uniqueWeeks = useMemo(() => {
    const set = new Set<string>();
    for (const p of picks) {
      const w = matchIndexToWeek.get(p.matchIndex);
      if (w !== undefined && w !== '') set.add(String(w));
    }
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [picks, matchIndexToWeek]);

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
      if (weekFilter) {
        const w = matchIndexToWeek.get(p.matchIndex);
        if (w === undefined || String(w) !== weekFilter) return false;
      }
      if (matchFilter && p.matchLabel !== matchFilter) return false;
      if (pickedFilter && p.pickedTeam !== pickedFilter) return false;
      if (marginFilter && p.diffBand !== marginFilter) return false;
      if (statusFilter === 'scored' && !p.resolved) return false;
      if (statusFilter === 'pending' && p.resolved) return false;
      return true;
    });
  }, [picks, userFilter, weekFilter, matchFilter, pickedFilter, marginFilter, statusFilter, matchIndexToWeek]);

  const hasActiveFilter =
    !!(userFilter || weekFilter || matchFilter || pickedFilter || marginFilter || statusFilter);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (secret.trim()) setAuthed(true);
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
            Pick&apos;em Admin
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

  return (
    <main>
      <div className="page container" style={{ maxWidth: 760 }}>
        <div className="page-header">
          <div>
            <h1>Admin — Picks</h1>
            <p className="subtitle">View and manage submitted picks</p>
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

        {/* Auto-resolve note */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 24 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            Picks and fantasy lineups score automatically from sheet state on page load. No manual resolve needed — just update the sheet.
          </p>
        </div>

        {/* All picks table */}
        <section style={{ marginTop: 16 }}>
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
                    value={weekFilter}
                    onChange={(e) => setWeekFilter(e.target.value)}
                    aria-label="Filter picks by week"
                  >
                    <option value="">All weeks</option>
                    {uniqueWeeks.map((w) => (
                      <option key={w} value={w}>Week {w}</option>
                    ))}
                  </select>
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
                        setWeekFilter('');
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
