'use client';
// src/app/picks/PicksClient.tsx

import { useRef, useState } from 'react';
import type { ScheduleEntry, UserPick, DiffBand } from '@/types';

// Team slug → primary color
const TEAM_COLORS: Record<string, string> = {
  atlanta:       '#C8102E',
  miami:         '#00B5CC',
  dallas:        '#003087',
  houston:       '#CE1141',
  nashville:     '#FFB81C',
  phoenix:       '#E56020',
  boston:        '#007A33',
  nyc:           '#003DA5',
  'las-vegas':   '#B4975A',
  'los-angeles': '#552583',
  philadelphia:  '#006BB6',
  'san-antonio': '#C4CED4',
};

function teamSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
}

function teamColor(name: string) {
  return TEAM_COLORS[teamSlug(name)] ?? 'var(--accent)';
}

function teamLogo(name: string) {
  return `/logos/${teamSlug(name)}.png`;
}

export const BANDS = [
  { key: 'close' as DiffBand,       label: '≤2 pts'  },
  { key: 'medium' as DiffBand,      label: '3–5 pts' },
  { key: 'comfortable' as DiffBand, label: '6–9 pts' },
  { key: 'dominant' as DiffBand,    label: '10+ pts' },
] as const;

interface PicksClientProps {
  upcoming: ScheduleEntry[];
  existingPicks: UserPick[];
  pendingPicks: UserPick[];
  scheduleMap: Record<number, { team1: string; team2: string; week: string | number }>;
  userId: string;
  currentWeek: number | null;
}

interface PickState {
  pickedTeam: string;
  diffBand: DiffBand | '';
  saving: boolean;
  saved: boolean;
  deleting: boolean;
  error: string;
}

function formatMatchDate(dateStr: string): string {
  if (!dateStr) return 'TBD';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return dateStr;
  }
}

const BAND_LABELS: Record<string, string> = {
  close: '≤2 pts',
  medium: '3–5 pts',
  comfortable: '6–9 pts',
  dominant: '10+ pts',
};

export function PicksClient({
  upcoming,
  existingPicks,
  pendingPicks,
  scheduleMap,
  userId: _userId,
  currentWeek,
}: PicksClientProps) {
  const initialStates: Record<number, PickState> = {};
  existingPicks.forEach((p) => {
    initialStates[p.match_index] = {
      pickedTeam: p.picked_team,
      diffBand: p.diff_band,
      saving: false,
      saved: true,
      deleting: false,
      error: '',
    };
  });

  const [pickStates, setPickStates] = useState<Record<number, PickState>>(initialStates);
  // Track deleted match indices so we hide them from the pending section
  const [deletedIndices, setDeletedIndices] = useState<Set<number>>(new Set());

  // Debounce timers + last-saved snapshot per match, so auto-save only fires
  // once per change and never re-POSTs an identical pick.
  const saveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const lastSaved = useRef<Record<number, { team: string; band: string }>>(
    existingPicks.reduce((acc, p) => {
      acc[p.match_index] = { team: p.picked_team, band: p.diff_band };
      return acc;
    }, {} as Record<number, { team: string; band: string }>)
  );

  function getState(matchIndex: number): PickState {
    return pickStates[matchIndex] ?? { pickedTeam: '', diffBand: '', saving: false, saved: false, deleting: false, error: '' };
  }

  function updateState(matchIndex: number, updates: Partial<PickState>) {
    setPickStates((prev) => ({
      ...prev,
      [matchIndex]: { ...getState(matchIndex), ...updates },
    }));
  }

  // Called whenever the user picks a team or margin. Schedules a debounced
  // save if both selections are present and differ from the last-saved pair.
  function selectAndAutoSave(matchIndex: number, updates: Partial<PickState>) {
    const next = { ...getState(matchIndex), ...updates, saved: false };
    updateState(matchIndex, { ...updates, saved: false, error: '' });

    if (next.pickedTeam && next.diffBand) {
      const last = lastSaved.current[matchIndex];
      const isDirty = !last || last.team !== next.pickedTeam || last.band !== next.diffBand;
      if (!isDirty) return;

      if (saveTimers.current[matchIndex]) clearTimeout(saveTimers.current[matchIndex]);
      saveTimers.current[matchIndex] = setTimeout(() => {
        savePick(matchIndex, next.pickedTeam, next.diffBand as DiffBand);
      }, 400);
    }
  }

  async function savePick(matchIndex: number, team: string, band: DiffBand) {
    updateState(matchIndex, { saving: true, error: '', saved: false });

    try {
      const res = await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_index: matchIndex,
          picked_team: team,
          diff_band: band,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        updateState(matchIndex, { saving: false, error: json.error ?? 'Failed to save pick' });
      } else {
        lastSaved.current[matchIndex] = { team, band };
        updateState(matchIndex, { saving: false, saved: true });
      }
    } catch {
      updateState(matchIndex, { saving: false, error: 'Network error. Please try again.' });
    }
  }

  async function deletePick(matchIndex: number) {
    updateState(matchIndex, { deleting: true, error: '' });
    try {
      const res = await fetch('/api/picks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_index: matchIndex }),
      });
      const json = await res.json();
      if (!res.ok) {
        updateState(matchIndex, { deleting: false, error: json.error ?? 'Failed to remove pick' });
      } else {
        delete lastSaved.current[matchIndex];
        if (saveTimers.current[matchIndex]) {
          clearTimeout(saveTimers.current[matchIndex]);
          delete saveTimers.current[matchIndex];
        }
        updateState(matchIndex, { deleting: false, saved: false, pickedTeam: '', diffBand: '' });
        setDeletedIndices((prev) => new Set(prev).add(matchIndex));
      }
    } catch {
      updateState(matchIndex, { deleting: false, error: 'Network error. Please try again.' });
    }
  }

  // Pending picks that haven't been deleted this session
  const visiblePending = pendingPicks.filter((p) => {
    if (deletedIndices.has(p.match_index)) return false;
    // Don't show in pending section if match is still open (it's in the main picks list)
    return !upcoming.some((u) => u.matchIndex === p.match_index);
  });

  return (
    <main>
      <div className="page container" style={{ maxWidth: 640 }}>
        <div className="page-header">
          <h1>Pick&apos;em</h1>
          <p className="subtitle">
            {currentWeek !== null ? `Week ${currentWeek}` : '2026 TBL Season'} — pick the winner &amp; winning margin
          </p>
        </div>

        {/* ── Open matches ── */}
        {upcoming.length === 0 && visiblePending.length === 0 && (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>
              No upcoming matches to pick right now. Check back soon.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {upcoming.map((entry) => {
            if (!entry.matchIndex) return null;
            const matchIndex = entry.matchIndex;
            const state = getState(matchIndex);
            const alreadyPicked = state.saved && !!state.pickedTeam;

            return (
              <div key={matchIndex} className="picks-card card">
                {/* Header */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Week {entry.week}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {alreadyPicked && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--result-w)', letterSpacing: '0.04em' }}>
                        ✓ Pick saved
                      </span>
                    )}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                      {formatMatchDate(entry.date)}
                    </span>
                  </div>
                </div>

                <div style={{ padding: 16 }}>
                  {/* Team selector — responsive: 1 col on mobile, 2 col on wider */}
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
                    Pick the winner
                  </p>
                  <div className="picks-team-grid" style={{ marginBottom: 20 }}>
                    {[entry.team1, entry.team2].map((team) => {
                      const color = teamColor(team);
                      const picked = state.pickedTeam === team;
                      return (
                        <button
                          key={team}
                          onClick={() => selectAndAutoSave(matchIndex, { pickedTeam: team })}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 8,
                            padding: '14px 12px',
                            borderRadius: 'var(--radius)',
                            border: `2px solid ${picked ? color : 'var(--border)'}`,
                            background: picked ? `${color}22` : 'var(--bg-card)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            width: '100%',
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={teamLogo(team)}
                            alt={team}
                            width={48}
                            height={48}
                            style={{ objectFit: 'contain', opacity: picked ? 1 : 0.6 }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 13,
                            fontWeight: 700,
                            color: picked ? color : 'var(--text)',
                            letterSpacing: '0.02em',
                          }}>
                            {team}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Band selector */}
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                    Winning margin
                  </p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                    Correct winner = 1pt · Exact margin too = 2pts
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 20 }}>
                    {BANDS.map((band) => (
                      <button
                        key={band.key}
                        onClick={() => selectAndAutoSave(matchIndex, { diffBand: band.key })}
                        className={`pick-band-btn${state.diffBand === band.key ? ' selected' : ''}`}
                      >
                        <span style={{ fontWeight: 700 }}>{band.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Auto-save status + Remove */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    {(() => {
                      const hasBoth = !!state.pickedTeam && !!state.diffBand;
                      if (state.saving) {
                        return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>⟳ Saving…</span>;
                      }
                      if (state.error) return null; // shown below
                      if (state.saved && hasBoth) {
                        return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--result-w)', fontWeight: 700 }}>✓ Saved</span>;
                      }
                      if (!hasBoth) {
                        return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>Select a team and margin — saves automatically</span>;
                      }
                      return null;
                    })()}
                    {alreadyPicked && (
                      <button
                        onClick={() => deletePick(matchIndex)}
                        disabled={state.deleting}
                        style={{
                          opacity: state.deleting ? 0.5 : 1,
                          fontFamily: 'var(--font-mono)',
                          fontSize: 12,
                          color: 'var(--result-l)',
                          border: '1px solid currentColor',
                          background: 'transparent',
                          padding: '6px 12px',
                          borderRadius: 'var(--radius)',
                          cursor: 'pointer',
                          marginLeft: 'auto',
                        }}
                      >
                        {state.deleting ? 'Removing…' : 'Remove pick'}
                      </button>
                    )}
                    {state.error && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--result-l)', width: '100%' }}>
                        ⚠ {state.error}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Pending picks (locked / game started but not yet scored) ── */}
        {visiblePending.length > 0 && (
          <section style={{ marginTop: upcoming.length > 0 ? 40 : 0 }}>
            <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
              Pending picks
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visiblePending.map((p) => {
                const info = scheduleMap[p.match_index];
                const state = getState(p.match_index);
                return (
                  <div key={p.match_index} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      {info && (
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Wk {info.week}
                        </div>
                      )}
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                        {info ? `${info.team1} vs ${info.team2}` : `Match ${p.match_index}`}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                        Picked: <span style={{ color: teamColor(p.picked_team), fontWeight: 700 }}>{p.picked_team}</span>
                        <span style={{ marginLeft: 8, opacity: 0.7 }}>· {BAND_LABELS[p.diff_band] ?? p.diff_band}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        🔒 Locked · awaiting result
                      </span>
                      <button
                        onClick={() => deletePick(p.match_index)}
                        disabled={state.deleting}
                        style={{
                          opacity: state.deleting ? 0.5 : 1,
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                          color: 'var(--result-l)',
                          border: '1px solid currentColor',
                          background: 'transparent',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius)',
                          cursor: 'pointer',
                        }}
                      >
                        {state.deleting ? 'Removing…' : 'Remove pick'}
                      </button>
                      {state.error && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--result-l)' }}>
                          {state.error}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
