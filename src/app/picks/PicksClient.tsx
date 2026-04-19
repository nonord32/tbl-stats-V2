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

export function PicksClient({ upcoming, existingPicks, userId: _userId }: PicksClientProps) {
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

  if (upcoming.length === 0) {
    return (
      <main>
        <div className="page container">
          <div className="page-header">
            <h1>Pick&apos;em</h1>
            <p className="subtitle">2026 TBL Season</p>
          </div>
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>
              No upcoming matches to pick right now. Check back soon.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="page container">
        <div className="page-header">
          <h1>Pick&apos;em</h1>
          <p className="subtitle">2026 TBL Season — pick the winner &amp; winning margin</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {upcoming.map((entry) => {
            if (!entry.matchIndex) return null;
            const matchIndex = entry.matchIndex;
            const state = getState(matchIndex);
            const canSave = !!state.pickedTeam && !!state.diffBand;
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
                  {/* Team selector */}
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
                    Pick the winner
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
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
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 20 }}>
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

                  {/* Save */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                      onClick={() => savePick(matchIndex)}
                      disabled={!canSave || state.saving}
                      className="btn btn-primary"
                      style={{ opacity: (!canSave || state.saving) ? 0.5 : 1 }}
                    >
                      {state.saving ? 'Saving…' : alreadyPicked ? 'Update Pick' : 'Save Pick'}
                    </button>
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
      </div>
    </main>
  );
}
