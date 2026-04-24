'use client';
// src/app/picks/PicksClient.tsx
// Gazette-styled Pick'em ballot: dark-ink panel on the selected team with an
// orange "PICK" label, earliest-lock countdown in the page header, margin
// band selection below each matchup. Auto-saves on change.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ScheduleEntry, UserPick, DiffBand } from '@/types';
import { getCityName, getTeamLogoPathByName } from '@/lib/teams';

// Compact team abbreviation — same mapping as the Schedule / Match pages.
function short(team: string): string {
  const city = getCityName(team).toUpperCase();
  const map: Record<string, string> = {
    'NEW YORK': 'NYC',
    NYC: 'NYC',
    'LOS ANGELES': 'LA',
    'LAS VEGAS': 'LV',
    'SAN ANTONIO': 'SA',
    ATLANTA: 'ATL',
    BOSTON: 'BOS',
    DALLAS: 'DAL',
    HOUSTON: 'HOU',
    MIAMI: 'MIA',
    NASHVILLE: 'NSH',
    PHILADELPHIA: 'PHI',
    PHOENIX: 'PHX',
  };
  return map[city] ?? city.slice(0, 3);
}

export const BANDS = [
  { key: 'close' as DiffBand,       label: '≤2 pts'  },
  { key: 'medium' as DiffBand,      label: '3–5 pts' },
  { key: 'comfortable' as DiffBand, label: '6–9 pts' },
  { key: 'dominant' as DiffBand,    label: '10+ pts' },
] as const;

const BAND_LABELS: Record<string, string> = {
  close: '≤2 pts',
  medium: '3–5 pts',
  comfortable: '6–9 pts',
  dominant: '10+ pts',
};

interface PicksClientProps {
  upcoming: ScheduleEntry[];
  existingPicks: UserPick[];
  pendingPicks: UserPick[];
  scheduleMap: Record<number, { team1: string; team2: string; week: string | number }>;
  userId: string;
  currentWeek: number | null;
  /** matchIndex → ISO string of the moment picks lock for that match. */
  lockTimes: Record<number, string>;
}

interface PickState {
  pickedTeam: string;
  diffBand: DiffBand | '';
  saving: boolean;
  saved: boolean;
  deleting: boolean;
  error: string;
}

// ── Countdown formatting ──────────────────────────────────────────────────
function formatCountdown(ms: number): string {
  if (ms <= 0) return 'LOCKED';
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}D ${hours}H`;
  if (hours > 0) return `${hours}H ${minutes.toString().padStart(2, '0')}M`;
  return `${minutes}M`;
}

function useNow(tickMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);
  return now;
}

// ── Date / time label helpers ─────────────────────────────────────────────
function formatRowDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d
      .toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'UTC' })
      .toUpperCase();
  } catch {
    return dateStr;
  }
}

export function PicksClient({
  upcoming,
  existingPicks,
  pendingPicks,
  scheduleMap,
  userId: _userId,
  currentWeek,
  lockTimes,
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

  const router = useRouter();

  const [pickStates, setPickStates] = useState<Record<number, PickState>>(initialStates);
  const [deletedIndices, setDeletedIndices] = useState<Set<number>>(new Set());

  const saveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const lastSaved = useRef<Record<number, { team: string; band: string }>>(
    existingPicks.reduce((acc, p) => {
      acc[p.match_index] = { team: p.picked_team, band: p.diff_band };
      return acc;
    }, {} as Record<number, { team: string; band: string }>)
  );

  const now = useNow();

  function getState(matchIndex: number): PickState {
    return pickStates[matchIndex] ?? { pickedTeam: '', diffBand: '', saving: false, saved: false, deleting: false, error: '' };
  }

  function updateState(matchIndex: number, updates: Partial<PickState>) {
    setPickStates((prev) => ({
      ...prev,
      [matchIndex]: { ...getState(matchIndex), ...updates },
    }));
  }

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
        body: JSON.stringify({ match_index: matchIndex, picked_team: team, diff_band: band }),
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
        router.refresh();
      }
    } catch {
      updateState(matchIndex, { deleting: false, error: 'Network error. Please try again.' });
    }
  }

  // Stats for the header chip: X picks of Y open, and earliest lock countdown.
  const madeCount = useMemo(() => {
    return upcoming.reduce((n, s) => {
      if (!s.matchIndex) return n;
      const st = pickStates[s.matchIndex];
      return st && st.saved && st.pickedTeam && st.diffBand ? n + 1 : n;
    }, 0);
  }, [upcoming, pickStates]);

  const totalCount = upcoming.filter((s) => s.matchIndex).length;

  const earliestLockMs = useMemo(() => {
    let min = Infinity;
    upcoming.forEach((s) => {
      if (!s.matchIndex) return;
      const iso = lockTimes[s.matchIndex];
      if (!iso) return;
      const t = new Date(iso).getTime();
      if (t < min) min = t;
    });
    return min === Infinity ? null : min;
  }, [upcoming, lockTimes]);

  const countdown = earliestLockMs != null ? formatCountdown(earliestLockMs - now) : null;

  const visiblePending = pendingPicks.filter((p) => {
    if (deletedIndices.has(p.match_index)) return false;
    return !upcoming.some((u) => u.matchIndex === p.match_index);
  });

  return (
    <>
      {/* ── Page header band ─────────────────────────────────────────── */}
      <div
        style={{
          padding: '36px 32px 26px',
          borderBottom: '3px double var(--tbl-ink)',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          alignItems: 'flex-end',
          gap: 24,
        }}
        className="gz-picks-header"
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--tbl-font-mono)',
              fontSize: 11,
              letterSpacing: '0.28em',
              color: 'var(--tbl-accent)',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            {currentWeek !== null ? `Week ${currentWeek} Entry` : '2026 TBL Season'}
          </div>
          <div
            className="tbl-display"
            style={{ fontSize: 68, lineHeight: 0.95, marginTop: 8 }}
          >
            Pick&apos;em
          </div>
          <div
            style={{
              fontFamily: 'var(--tbl-font-mono)',
              fontSize: 11,
              letterSpacing: '0.22em',
              color: 'var(--tbl-ink-soft)',
              textTransform: 'uppercase',
              fontWeight: 700,
              marginTop: 10,
            }}
          >
            Pick every fight · Rank the margin · Locks before the bell
          </div>
        </div>

        {totalCount > 0 && (
          <div
            style={{
              background: 'var(--tbl-ink)',
              color: 'var(--tbl-bg)',
              padding: '12px 18px',
              display: 'flex',
              gap: 22,
              alignItems: 'center',
              minWidth: 220,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'var(--tbl-font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.22em',
                  fontWeight: 700,
                  color: 'rgba(244,237,224,0.55)',
                  textTransform: 'uppercase',
                }}
              >
                Made
              </div>
              <div
                className="tbl-display"
                style={{ fontSize: 28, lineHeight: 1, marginTop: 2 }}
              >
                {madeCount}/{totalCount}
              </div>
            </div>
            <div
              style={{
                width: 1,
                alignSelf: 'stretch',
                background: 'rgba(244,237,224,0.25)',
              }}
            />
            <div>
              <div
                style={{
                  fontFamily: 'var(--tbl-font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.22em',
                  fontWeight: 700,
                  color: 'rgba(244,237,224,0.55)',
                  textTransform: 'uppercase',
                }}
              >
                Entry locks
              </div>
              <div
                className="tbl-display"
                style={{
                  fontSize: 28,
                  lineHeight: 1,
                  marginTop: 2,
                  color: 'var(--tbl-accent-bright)',
                }}
              >
                {countdown ?? '—'}
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '26px 32px 48px' }}>
        {/* ── Empty state ── */}
        {upcoming.length === 0 && visiblePending.length === 0 && (
          <div
            style={{
              background: 'var(--tbl-paper)',
              border: '1.5px solid var(--tbl-ink)',
              padding: 40,
              textAlign: 'center',
              fontFamily: 'var(--tbl-font-mono)',
              fontSize: 12,
              color: 'var(--tbl-ink-soft)',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}
          >
            No upcoming matches to pick right now. Check back soon.
          </div>
        )}

        {/* ── Ballot ── */}
        {upcoming.length > 0 && (
          <>
            <div className="tbl-section-rule">
              <span>Your Ballot{currentWeek !== null ? ` · Week ${currentWeek}` : ''}</span>
              <span>Winner · Margin · Auto-saves</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {upcoming.map((entry) => {
                if (!entry.matchIndex) return null;
                const matchIndex = entry.matchIndex;
                const state = getState(matchIndex);
                const alreadyPicked = state.saved && !!state.pickedTeam;

                const lockIso = lockTimes[matchIndex];
                const rowLockMs = lockIso ? new Date(lockIso).getTime() - now : null;
                const rowCountdown =
                  rowLockMs != null ? formatCountdown(rowLockMs) : null;

                return (
                  <div
                    key={matchIndex}
                    className="gz-pick-row"
                    style={{
                      border: '1.5px solid var(--tbl-ink)',
                      background: 'var(--tbl-bg)',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '160px 1fr 1fr',
                        gap: 0,
                      }}
                      className="gz-pick-row__grid"
                    >
                      {/* Left: date + countdown */}
                      <div
                        style={{
                          padding: '18px 16px',
                          borderRight: '1px solid var(--tbl-ink)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                          justifyContent: 'center',
                          fontFamily: 'var(--tbl-font-mono)',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            letterSpacing: '0.18em',
                            color: 'var(--tbl-ink-soft)',
                            fontWeight: 700,
                          }}
                        >
                          {formatRowDate(entry.date)}
                        </div>
                        {entry.time && (
                          <div
                            className="tbl-display"
                            style={{ fontSize: 20, lineHeight: 1, marginTop: 2 }}
                          >
                            {entry.time.replace(/\s*local/i, '').trim()}
                          </div>
                        )}
                        {rowCountdown && (
                          <div
                            style={{
                              fontSize: 10,
                              letterSpacing: '0.16em',
                              color:
                                rowLockMs && rowLockMs < 60 * 60 * 1000
                                  ? 'var(--tbl-accent-bright)'
                                  : 'var(--tbl-accent)',
                              fontWeight: 700,
                              marginTop: 6,
                              textTransform: 'uppercase',
                            }}
                          >
                            {rowLockMs != null && rowLockMs <= 0
                              ? 'Locked'
                              : `Locks in ${rowCountdown}`}
                          </div>
                        )}
                      </div>

                      {/* Middle: two team panels */}
                      <TeamPanel
                        team={entry.team1}
                        picked={state.pickedTeam === entry.team1}
                        onClick={() =>
                          selectAndAutoSave(matchIndex, { pickedTeam: entry.team1 })
                        }
                      />
                      <TeamPanel
                        team={entry.team2}
                        picked={state.pickedTeam === entry.team2}
                        onClick={() =>
                          selectAndAutoSave(matchIndex, { pickedTeam: entry.team2 })
                        }
                      />
                    </div>

                    {/* Margin row */}
                    <div
                      style={{
                        borderTop: '1px solid var(--tbl-ink)',
                        padding: '14px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        flexWrap: 'wrap',
                        background: 'var(--tbl-paper)',
                      }}
                    >
                      <div
                        style={{
                          fontFamily: 'var(--tbl-font-mono)',
                          fontSize: 10,
                          letterSpacing: '0.22em',
                          color: 'var(--tbl-ink-soft)',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        Margin
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {BANDS.map((band) => {
                          const selected = state.diffBand === band.key;
                          return (
                            <button
                              key={band.key}
                              onClick={() =>
                                selectAndAutoSave(matchIndex, { diffBand: band.key })
                              }
                              style={{
                                padding: '6px 12px',
                                border: '1.5px solid var(--tbl-ink)',
                                background: selected ? 'var(--tbl-accent)' : 'transparent',
                                color: selected ? '#fff' : 'var(--tbl-ink)',
                                fontFamily: 'var(--tbl-font-mono)',
                                fontSize: 12,
                                fontWeight: 700,
                                letterSpacing: '0.06em',
                                cursor: 'pointer',
                              }}
                            >
                              {band.label}
                            </button>
                          );
                        })}
                      </div>

                      <div
                        style={{
                          marginLeft: 'auto',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          flexWrap: 'wrap',
                          fontFamily: 'var(--tbl-font-mono)',
                          fontSize: 11,
                          letterSpacing: '0.1em',
                        }}
                      >
                        {state.saving && (
                          <span style={{ color: 'var(--tbl-ink-soft)' }}>Saving…</span>
                        )}
                        {!state.saving && state.saved && state.pickedTeam && state.diffBand && (
                          <span style={{ color: 'var(--tbl-green)', fontWeight: 700 }}>
                            ✓ Saved
                          </span>
                        )}
                        {!state.saving &&
                          (!state.pickedTeam || !state.diffBand) &&
                          !state.error && (
                            <span style={{ color: 'var(--tbl-ink-soft)' }}>
                              Pick a team &amp; margin
                            </span>
                          )}
                        {state.error && (
                          <span style={{ color: 'var(--tbl-red)', fontWeight: 700 }}>
                            ⚠ {state.error}
                          </span>
                        )}
                        {alreadyPicked && (
                          <button
                            onClick={() => deletePick(matchIndex)}
                            disabled={state.deleting}
                            style={{
                              opacity: state.deleting ? 0.5 : 1,
                              fontFamily: 'var(--tbl-font-mono)',
                              fontSize: 11,
                              color: 'var(--tbl-red)',
                              border: '1px solid var(--tbl-red)',
                              background: 'transparent',
                              padding: '5px 12px',
                              cursor: 'pointer',
                              fontWeight: 700,
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                            }}
                          >
                            {state.deleting ? 'Removing…' : 'Remove'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Pending / locked picks ── */}
        {visiblePending.length > 0 && (
          <section style={{ marginTop: upcoming.length > 0 ? 40 : 0 }}>
            <div className="tbl-section-rule">
              <span>Pending Picks</span>
              <span>Locked · awaiting result</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visiblePending.map((p) => {
                const info = scheduleMap[p.match_index];
                const state = getState(p.match_index);
                return (
                  <div
                    key={p.match_index}
                    style={{
                      background: 'var(--tbl-paper)',
                      border: '1.5px solid var(--tbl-ink)',
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 12,
                    }}
                  >
                    <div>
                      {info && (
                        <div
                          style={{
                            fontFamily: 'var(--tbl-font-mono)',
                            fontSize: 10,
                            letterSpacing: '0.2em',
                            color: 'var(--tbl-ink-soft)',
                            textTransform: 'uppercase',
                            fontWeight: 700,
                          }}
                        >
                          Week {info.week}
                        </div>
                      )}
                      <div
                        className="tbl-display"
                        style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}
                      >
                        {info ? (
                          <>
                            {short(info.team1)}{' '}
                            <span
                              style={{
                                color: 'var(--tbl-ink-soft)',
                                fontStyle: 'italic',
                                fontWeight: 400,
                              }}
                            >
                              vs
                            </span>{' '}
                            {short(info.team2)}
                          </>
                        ) : (
                          `Match ${p.match_index}`
                        )}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--tbl-font-mono)',
                          fontSize: 11,
                          letterSpacing: '0.08em',
                          color: 'var(--tbl-ink-soft)',
                          marginTop: 4,
                        }}
                      >
                        Picked:{' '}
                        <span style={{ color: 'var(--tbl-accent)', fontWeight: 700 }}>
                          {short(p.picked_team)}
                        </span>
                        <span style={{ marginLeft: 8 }}>
                          · {BAND_LABELS[p.diff_band] ?? p.diff_band}
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--tbl-font-mono)',
                          fontSize: 10,
                          letterSpacing: '0.2em',
                          color: 'var(--tbl-ink-soft)',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                        }}
                      >
                        Locked
                      </span>
                      <button
                        onClick={() => deletePick(p.match_index)}
                        disabled={state.deleting}
                        style={{
                          opacity: state.deleting ? 0.5 : 1,
                          fontFamily: 'var(--tbl-font-mono)',
                          fontSize: 10,
                          color: 'var(--tbl-red)',
                          border: '1px solid var(--tbl-red)',
                          background: 'transparent',
                          padding: '4px 10px',
                          cursor: 'pointer',
                          fontWeight: 700,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {state.deleting ? 'Removing' : 'Remove'}
                      </button>
                      {state.error && (
                        <span
                          style={{
                            fontFamily: 'var(--tbl-font-mono)',
                            fontSize: 11,
                            color: 'var(--tbl-red)',
                          }}
                        >
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
    </>
  );
}

// ── Team panel (dark when picked, with orange PICK label) ────────────────
function TeamPanel({
  team,
  picked,
  onClick,
}: {
  team: string;
  picked: boolean;
  onClick: () => void;
}) {
  const logo = getTeamLogoPathByName(team);
  return (
    <button
      onClick={onClick}
      style={{
        background: picked ? 'var(--tbl-ink)' : 'var(--tbl-paper)',
        color: picked ? 'var(--tbl-bg)' : 'var(--tbl-ink)',
        border: 'none',
        borderRight: '1px solid var(--tbl-ink)',
        cursor: 'pointer',
        padding: '18px 18px',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        gap: 14,
        transition: 'background 0.15s ease, color 0.15s ease',
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
      className={`gz-pick-team${picked ? ' is-picked' : ''}`}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt=""
          style={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }}
        />
      ) : (
        <span style={{ width: 40, height: 40 }} />
      )}
      <div
        className="tbl-display"
        style={{ fontSize: 26, lineHeight: 1, fontWeight: 900 }}
      >
        {short(team)}
      </div>
      <div
        style={{
          fontFamily: 'var(--tbl-font-mono)',
          fontSize: 11,
          letterSpacing: '0.22em',
          fontWeight: 700,
          color: picked ? 'var(--tbl-accent-bright)' : 'var(--tbl-ink-soft)',
          textTransform: 'uppercase',
          minWidth: 42,
          textAlign: 'right',
        }}
      >
        {picked ? 'Pick' : ''}
      </div>
    </button>
  );
}
