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

interface PlayerRow {
  userId: string;
  displayName: string;
  username: string;
  hidden: boolean;
}

interface FighterAdminRow {
  slug: string;
  name: string;
  team: string;
  instagram: string;
}

interface DbDebug {
  picksCount: number;
  picksError: string | null;
  profilesCount: number;
  profilesError: string | null;
  serviceKeySet: boolean;
}

export function AdminClient({ matches, picks: initialPicks, players: initialPlayers, fighters: initialFighters, dbError, dbDebug }: { matches: MatchEntry[]; picks: PickRow[]; players: PlayerRow[]; fighters: FighterAdminRow[]; dbError: string | null; dbDebug: DbDebug }) {
  const [secret, setSecret] = useState('');
  const [authed, setAuthed] = useState(false);

  // Fighter Instagram editor state + CSV export state.
  const [fighters, setFighters] = useState<FighterAdminRow[]>(initialFighters);
  const [fighterFilter, setFighterFilter] = useState('');
  const [igDrafts, setIgDrafts] = useState<Record<string, string>>({});
  const [savingIg, setSavingIg] = useState<string | null>(null);
  const [igError, setIgError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Local copy of picks so deletions update the table without a page reload.
  // Keyed by `${userId}:${matchIndex}` since that's our composite identity.
  const [picks, setPicks] = useState<PickRow[]>(initialPicks);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Players list + hide/show-from-leaderboard controls.
  const [players, setPlayers] = useState<PlayerRow[]>(initialPlayers);
  const [playerFilter, setPlayerFilter] = useState('');
  const [togglingPlayer, setTogglingPlayer] = useState<string | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);

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

  const filteredPlayers = useMemo(() => {
    const q = playerFilter.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) =>
      (p.displayName || '').toLowerCase().includes(q) ||
      (p.username || '').toLowerCase().includes(q)
    );
  }, [players, playerFilter]);

  const hiddenCount = useMemo(() => players.filter((p) => p.hidden).length, [players]);

  async function handleToggleHidden(p: PlayerRow) {
    const nextHidden = !p.hidden;
    setTogglingPlayer(p.userId);
    setPlayerError(null);
    try {
      const res = await fetch('/api/admin/toggle-hidden', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ user_id: p.userId, hidden: nextHidden }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPlayerError(json.error || `Update failed (${res.status})`);
        return;
      }
      setPlayers((prev) =>
        prev.map((row) => (row.userId === p.userId ? { ...row, hidden: nextHidden } : row))
      );
    } catch {
      setPlayerError('Network error while updating player.');
    } finally {
      setTogglingPlayer(null);
    }
  }

  const filteredFighters = useMemo(() => {
    const q = fighterFilter.trim().toLowerCase();
    if (!q) return fighters;
    return fighters.filter(
      (f) => f.name.toLowerCase().includes(q) || f.team.toLowerCase().includes(q)
    );
  }, [fighters, fighterFilter]);

  async function handleSaveInstagram(f: FighterAdminRow) {
    const value = (igDrafts[f.slug] ?? f.instagram).trim();
    setSavingIg(f.slug);
    setIgError(null);
    try {
      const res = await fetch('/api/admin/fighter-instagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
        body: JSON.stringify({ slug: f.slug, instagram: value }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setIgError(json.error || `Save failed (${res.status})`);
        return;
      }
      const saved = typeof json.instagram === 'string' ? json.instagram : value;
      setFighters((prev) => prev.map((row) => (row.slug === f.slug ? { ...row, instagram: saved } : row)));
      setIgDrafts((prev) => {
        const next = { ...prev };
        delete next[f.slug];
        return next;
      });
    } catch {
      setIgError('Network error while saving Instagram.');
    } finally {
      setSavingIg(null);
    }
  }

  async function handleExport(kind: 'fighters' | 'standings' | 'matches' | 'bouts' | 'xlsx') {
    setExporting(kind);
    setExportError(null);
    try {
      const query = kind === 'xlsx' ? 'format=xlsx' : `type=${kind}`;
      const res = await fetch(`/api/admin/export?${query}`, {
        headers: { Authorization: `Bearer ${secret}` },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setExportError(json.error || `Export failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = kind === 'xlsx' ? 'tbl-data.xlsx' : `tbl-${kind}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError('Network error while exporting.');
    } finally {
      setExporting(null);
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

        {/* Export recalculated data as CSV */}
        <section style={{ marginTop: 16, marginBottom: 32 }}>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
            Export Data
          </h2>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
            Download the code-recalculated data. The Excel workbook bundles every dataset as tabs (incl. the WAR formula + league constants); the CSVs are one dataset each. Either way, the Fighters data shows every stat plus the replacement PPR + avg margin, so you can see exactly where each number comes from.
          </p>
          {exportError && (
            <div style={{ padding: '8px 0', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--result-l)' }}>
              {exportError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={exporting === 'xlsx'}
              onClick={() => handleExport('xlsx')}
              style={{ opacity: exporting === 'xlsx' ? 0.6 : 1, cursor: exporting === 'xlsx' ? 'wait' : 'pointer' }}
            >
              {exporting === 'xlsx' ? 'Exporting…' : 'Excel workbook (.xlsx)'}
            </button>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>or CSV:</span>
            {(['fighters', 'standings', 'matches', 'bouts'] as const).map((t) => (
              <button
                key={t}
                type="button"
                className="btn"
                disabled={exporting === t}
                onClick={() => handleExport(t)}
                style={{ opacity: exporting === t ? 0.6 : 1, cursor: exporting === t ? 'wait' : 'pointer' }}
              >
                {exporting === t ? 'Exporting…' : `${t[0].toUpperCase()}${t.slice(1)}`}
              </button>
            ))}
          </div>
        </section>

        {/* Fighter Instagram editor — overrides the Google Sheet */}
        <section style={{ marginTop: 16, marginBottom: 32 }}>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
            Fighter Instagram ({fighters.length})
          </h2>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
            Set a fighter&apos;s Instagram URL here — a saved value overrides the Google Sheet everywhere. Clear the field and save to remove it.
          </p>
          {fighters.length === 0 ? (
            <div className="card" style={{ padding: 24 }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>No fighters found.</p>
            </div>
          ) : (
            <div className="card">
              <div className="card-header">
                <div className="filters">
                  <input
                    type="search"
                    className="filter-search"
                    placeholder="Search fighter…"
                    value={fighterFilter}
                    onChange={(e) => setFighterFilter(e.target.value)}
                    aria-label="Filter fighters by name or team"
                  />
                  {fighterFilter && (
                    <button type="button" onClick={() => setFighterFilter('')} className="filter-clear">
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <div className="table-wrap">
                {igError && (
                  <div style={{ padding: '8px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--result-l)' }}>
                    {igError}
                  </div>
                )}
                <table>
                  <thead>
                    <tr>
                      <th>Fighter</th>
                      <th>Team</th>
                      <th>Instagram</th>
                      <th className="num-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFighters.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: 24, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                          No fighters match the current filter.
                        </td>
                      </tr>
                    ) : (
                      filteredFighters.map((f) => {
                        const draft = igDrafts[f.slug] ?? f.instagram;
                        const isSaving = savingIg === f.slug;
                        const dirty = draft.trim() !== f.instagram.trim();
                        return (
                          <tr key={f.slug}>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600 }}>{f.name}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{f.team}</td>
                            <td>
                              <input
                                type="text"
                                className="filter-search"
                                style={{ minWidth: 220, width: '100%' }}
                                placeholder="instagram.com/handle or @handle"
                                value={draft}
                                onChange={(e) => setIgDrafts((prev) => ({ ...prev, [f.slug]: e.target.value }))}
                              />
                            </td>
                            <td className="num-cell">
                              <button
                                type="button"
                                onClick={() => handleSaveInstagram(f)}
                                disabled={isSaving || !dirty}
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  letterSpacing: '0.08em',
                                  textTransform: 'uppercase',
                                  color: dirty ? 'var(--result-w)' : 'var(--text-muted)',
                                  background: 'transparent',
                                  border: `1px solid ${dirty ? 'var(--result-w)' : 'var(--border)'}`,
                                  borderRadius: 'var(--radius)',
                                  padding: '4px 10px',
                                  cursor: isSaving ? 'wait' : dirty ? 'pointer' : 'default',
                                  opacity: isSaving ? 0.5 : 1,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {isSaving ? 'Saving…' : 'Save'}
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

        {/* Players — hide/show from leaderboard */}
        <section style={{ marginTop: 16, marginBottom: 32 }}>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
            Players ({players.length}{hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ''})
          </h2>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
            Hidden players are removed from the public leaderboard. Their picks are kept.
          </p>
          {players.length === 0 ? (
            <div className="card" style={{ padding: 24 }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>No players found.</p>
            </div>
          ) : (
            <div className="card">
              <div className="card-header">
                <div className="filters">
                  <input
                    type="search"
                    className="filter-search"
                    placeholder="Search player…"
                    value={playerFilter}
                    onChange={(e) => setPlayerFilter(e.target.value)}
                    aria-label="Filter players by name"
                  />
                  {playerFilter && (
                    <button type="button" onClick={() => setPlayerFilter('')} className="filter-clear">
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <div className="table-wrap">
                {playerError && (
                  <div style={{ padding: '8px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--result-l)' }}>
                    {playerError}
                  </div>
                )}
                <table>
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Username</th>
                      <th className="num-cell">Status</th>
                      <th className="num-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlayers.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: 24, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                          No players match the current filter.
                        </td>
                      </tr>
                    ) : (
                      filteredPlayers.map((p) => {
                        const isToggling = togglingPlayer === p.userId;
                        return (
                          <tr key={p.userId} style={{ opacity: p.hidden ? 0.55 : 1 }}>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600 }}>
                              {p.displayName || '—'}
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                              {p.username ? `@${p.username}` : '—'}
                            </td>
                            <td className="num-cell" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: p.hidden ? 'var(--result-l)' : 'var(--result-w)' }}>
                              {p.hidden ? 'Hidden' : 'Visible'}
                            </td>
                            <td className="num-cell">
                              <button
                                type="button"
                                onClick={() => handleToggleHidden(p)}
                                disabled={isToggling}
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  letterSpacing: '0.08em',
                                  textTransform: 'uppercase',
                                  color: p.hidden ? 'var(--result-w)' : 'var(--text-muted)',
                                  background: 'transparent',
                                  border: `1px solid ${p.hidden ? 'var(--result-w)' : 'var(--border)'}`,
                                  borderRadius: 'var(--radius)',
                                  padding: '4px 10px',
                                  cursor: isToggling ? 'wait' : 'pointer',
                                  opacity: isToggling ? 0.5 : 1,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {isToggling ? 'Saving…' : p.hidden ? 'Show' : 'Hide'}
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
