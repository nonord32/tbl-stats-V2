'use client';
// src/app/picks/PicksClient.tsx

import { useState } from 'react';
import type { ScheduleEntry, UserPick, DiffBand } from '@/types';

export const BANDS = [
  { key: 'close' as DiffBand,       label: '≤2 pts',  pts: 5 },
  { key: 'medium' as DiffBand,      label: '3–5 pts', pts: 4 },
  { key: 'comfortable' as DiffBand, label: '6–9 pts', pts: 3 },
  { key: 'dominant' as DiffBand,    label: '10+ pts', pts: 2 },
] as const;

interface PicksClientProps {
  upcoming: ScheduleEntry[];
  lockedOrPast: ScheduleEntry[];
  existingPicks: UserPick[];
  userId: string;
}

interface PickState {
  pickedTeam: string;
  diffBand: DiffBand | '';
  saving: boolean;
  saved: boolean;
  error: string;
}

function formatMatchDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
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

export function PicksClient({ upcoming, lockedOrPast, existingPicks, userId: _userId }: PicksClientProps) {
  // Build initial pick state from existing picks
  const initialStates: Record<number, PickState> = {};
  existingPicks.forEach((p) => {
    initialStates[p.match_index] = {
      pickedTeam: p.picked_team,
      diffBand: p.diff_band,
      saving: false,
      saved: true,
      error: '',
    };
  });

  const [pickStates, setPickStates] = useState<Record<number, PickState>>(initialStates);

  function getState(matchIndex: number): PickState {
    return pickStates[matchIndex] ?? { pickedTeam: '', diffBand: '', saving: false, saved: false, error: '' };
  }

  function updateState(matchIndex: number, updates: Partial<PickState>) {
    setPickStates((prev) => ({
      ...prev,
      [matchIndex]: { ...getState(matchIndex), ...updates },
    }));
  }

  async function savePick(matchIndex: number) {
    const state = getState(matchIndex);
    if (!state.pickedTeam || !state.diffBand) return;

    updateState(matchIndex, { saving: true, error: '', saved: false });

    try {
      const res = await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_index: matchIndex,
          picked_team: state.pickedTeam,
          diff_band: state.diffBand,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        updateState(matchIndex, { saving: false, error: json.error ?? 'Failed to save pick' });
      } else {
        updateState(matchIndex, { saving: false, saved: true });
      }
    } catch {
      updateState(matchIndex, { saving: false, error: 'Network error. Please try again.' });
    }
  }

  return (
    <main>
      <div className="page container">
        <div className="page-header">
          <h1>Pick&apos;em</h1>
          <p className="subtitle">2026 TBL Season</p>
        </div>

        {/* ── Upcoming picks ── */}
        {upcoming.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>
              Open Picks
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {upcoming.map((entry) => {
                if (!entry.matchIndex) return null;
                const matchIndex = entry.matchIndex;
                const state = getState(matchIndex);
                const canSave = !!state.pickedTeam && !!state.diffBand;

                return (
                  <div key={matchIndex} className="picks-card card">
                    {/* Week + date header */}
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        Week {entry.week}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                        {formatMatchDate(entry.date)}
                      </span>
                    </div>

                    <div style={{ padding: 16 }}>
                      {/* Team selector */}
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
                        Pick a winner
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                        {[entry.team1, entry.team2].map((team) => (
                          <button
                            key={team}
                            onClick={() => updateState(matchIndex, { pickedTeam: team, saved: false })}
                            className={`pick-team-btn${state.pickedTeam === team ? ' selected' : ''}`}
                          >
                            {team}
                          </button>
                        ))}
                      </div>

                      {/* Band selector */}
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
                        Winning margin
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
                        {BANDS.map((band) => (
                          <button
                            key={band.key}
                            onClick={() => updateState(matchIndex, { diffBand: band.key, saved: false })}
                            className={`pick-band-btn${state.diffBand === band.key ? ' selected' : ''}`}
                          >
                            <span style={{ fontWeight: 700 }}>{band.label}</span>
                            <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: 11 }}>· {band.pts}pts</span>
                          </button>
                        ))}
                      </div>

                      {/* Save button */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button
                          onClick={() => savePick(matchIndex)}
                          disabled={!canSave || state.saving}
                          className="btn btn-primary"
                          style={{ opacity: (!canSave || state.saving) ? 0.5 : 1 }}
                        >
                          {state.saving ? 'Saving…' : 'Save Pick'}
                        </button>
                        {state.saved && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--result-w)' }}>
                            Saved
                          </span>
                        )}
                        {state.error && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--result-l)' }}>
                            {state.error}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Locked / Past picks ── */}
        {lockedOrPast.length > 0 && (
          <section>
            <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>
              Past &amp; Locked Matches
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {lockedOrPast.map((entry) => {
                if (!entry.matchIndex) return null;
                const matchIndex = entry.matchIndex;
                const existingPick = existingPicks.find((p) => p.match_index === matchIndex);

                return (
                  <div key={matchIndex} className={`picks-card card${!existingPick ? ' picks-card--no-pick' : ''}`} style={{ opacity: !existingPick ? 0.6 : 1 }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        Week {entry.week} &middot; {formatMatchDate(entry.date)}
                      </span>
                      <span className={`badge${entry.status === 'Completed' ? '' : ''}`} style={{ background: entry.status === 'Completed' ? 'var(--bg-table-alt)' : 'rgba(255,60,0,0.1)', color: entry.status === 'Completed' ? 'var(--text-muted)' : 'var(--accent)' }}>
                        {entry.status}
                      </span>
                    </div>
                    <div style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                          {entry.team1}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>vs</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                          {entry.team2}
                        </span>
                      </div>

                      {existingPick ? (
                        <LockedPickResult pick={existingPick} />
                      ) : (
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                          No pick submitted
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {upcoming.length === 0 && lockedOrPast.length === 0 && (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>
              No matches scheduled yet. Check back soon.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function LockedPickResult({ pick }: { pick: UserPick }) {
  const bandInfo = BANDS.find((b) => b.key === pick.diff_band);
  const isResolved = pick.resolved_at !== null;
  const won = pick.is_correct_winner;
  const exactBand = pick.is_correct_band;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
        Picked:
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
        {pick.picked_team}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
        {bandInfo?.label ?? pick.diff_band}
      </span>

      {isResolved ? (
        <>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: won ? 'var(--result-w)' : 'var(--result-l)', fontWeight: 700 }}>
            {won ? 'W' : 'L'}
          </span>
          {won && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: exactBand ? 'var(--result-w)' : 'var(--text-muted)' }}>
              {exactBand ? 'Exact' : 'Off band'}
            </span>
          )}
          <span className={`badge${pick.points_earned > 0 ? ' badge-win' : ''}`}>
            {pick.points_earned} pts
          </span>
        </>
      ) : (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
          (pending result)
        </span>
      )}
    </div>
  );
}
