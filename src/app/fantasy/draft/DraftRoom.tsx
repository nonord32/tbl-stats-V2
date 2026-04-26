'use client';
// Interactive mock draft. Client-side state drives:
//   - 8-team snake order
//   - 60s clock on the user's picks (AI picks resolve in ~700ms each)
//   - "Best available" auto-pick when the user's clock hits zero
//   - Live roster view by slot eligibility AND by TBL team
//
// Real fighter data is passed in from the server component as `pool`. All
// draft-state machinery (snake order, clock, AI logic) lives here.

import { useEffect, useMemo, useState } from 'react';
import type { FantasyFighter } from '@/lib/fantasyMock';

interface Pick {
  pickNumber: number;
  round: number;
  teamIndex: number;
  team: string;
  fighter: FantasyFighter;
}

interface DraftRoomProps {
  pool: FantasyFighter[];
  teams: string[];          // length 8
  userTeamIndex: number;    // 0..7
  rounds: number;           // total rounds (default 10)
  pickClockSeconds: number; // user's clock per pick, default 60
}

const FEMALE_CLASSES = new Set(['Super Lightweight', 'Bantamweight', 'Featherweight']);
const SLOT_BUCKETS: { label: string; need: number; matches: (f: FantasyFighter) => boolean }[] = [
  { label: 'Female',    need: 1, matches: (f) => f.gender === 'Female' && FEMALE_CLASSES.has(f.weightClass) },
  { label: 'Light',     need: 1, matches: (f) => f.gender === 'Male'   && ['Featherweight', 'Lightweight'].includes(f.weightClass) },
  { label: 'Welter',    need: 1, matches: (f) => f.gender === 'Male'   && ['Welterweight', 'Super Welterweight'].includes(f.weightClass) },
  { label: 'Middle',    need: 1, matches: (f) => f.gender === 'Male'   && ['Middleweight', 'Super Middleweight'].includes(f.weightClass) },
  { label: 'Heavy',     need: 1, matches: (f) => f.gender === 'Male'   && ['Light Heavyweight', 'Cruiserweight', 'Heavyweight'].includes(f.weightClass) },
];
const FLEX_NEED = 2;

// ── Snake order: pick 1..N. Returns the team index on the clock. ─────────
function teamOnClock(pickNumber: number, totalTeams: number): number {
  const round = Math.ceil(pickNumber / totalTeams);
  const indexInRound = (pickNumber - 1) % totalTeams;
  return round % 2 === 1 ? indexInRound : totalTeams - 1 - indexInRound;
}

// ── AI pick: simple "best available, weighted by team needs". ─────────────
function aiSelect(
  available: FantasyFighter[],
  teamPicks: FantasyFighter[]
): FantasyFighter {
  const filledBucket = SLOT_BUCKETS.map((b) =>
    teamPicks.filter((f) => b.matches(f)).length
  );
  // First pass: fighters that satisfy a still-unfilled position bucket
  const needIdx = filledBucket.findIndex((c, i) => c < SLOT_BUCKETS[i].need);
  if (needIdx >= 0) {
    const bucket = SLOT_BUCKETS[needIdx];
    const eligible = available.filter((f) => bucket.matches(f));
    if (eligible.length > 0) return eligible[0]; // already projected-sorted
  }
  // Otherwise best available
  return available[0];
}

type SortKey = 'projected' | 'avg' | 'owned' | 'name';

export function DraftRoom({
  pool,
  teams,
  userTeamIndex,
  rounds,
  pickClockSeconds,
}: DraftRoomProps) {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(pickClockSeconds);
  const [phase, setPhase] = useState<'pre' | 'drafting' | 'complete'>('pre');
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('projected');

  const totalPicks = teams.length * rounds;
  const currentPickNumber = picks.length + 1;
  const currentRound = Math.ceil(currentPickNumber / teams.length);
  const onClockIndex =
    phase === 'complete' ? -1 : teamOnClock(currentPickNumber, teams.length);
  const isUserTurn = phase === 'drafting' && onClockIndex === userTeamIndex;
  const teamOnClockName = onClockIndex >= 0 ? teams[onClockIndex] : '';

  // Pool index for fast lookup
  const poolById = useMemo(() => {
    const m = new Map<string, FantasyFighter>();
    pool.forEach((f) => m.set(f.id, f));
    return m;
  }, [pool]);

  const draftedIds = useMemo(
    () => new Set(picks.map((p) => p.fighter.id)),
    [picks]
  );

  // Available pool, sorted/filtered for the table
  const availableSorted = useMemo(() => {
    const all = pool.filter((f) => !draftedIds.has(f.id));
    const q = search.trim().toLowerCase();
    return all
      .filter((f) => {
        if (q && !f.name.toLowerCase().includes(q)) return false;
        if (classFilter && f.weightClass !== classFilter) return false;
        if (genderFilter && f.gender !== genderFilter) return false;
        return true;
      })
      .sort((a, b) => {
        switch (sortKey) {
          case 'avg':       return b.avg - a.avg;
          case 'owned':     return b.owned - a.owned;
          case 'name':      return a.name.localeCompare(b.name);
          case 'projected':
          default:          return b.projected - a.projected;
        }
      });
  }, [pool, draftedIds, search, classFilter, genderFilter, sortKey]);

  const allClasses = useMemo(() => {
    const set = new Set<string>();
    pool.forEach((f) => set.add(f.weightClass));
    return Array.from(set).sort();
  }, [pool]);

  // ── Make a pick (user or auto) ──────────────────────────────────────────
  const makePick = (fighter: FantasyFighter) => {
    if (phase !== 'drafting') return;
    if (draftedIds.has(fighter.id)) return;
    setPicks((prev) => {
      const pickNumber = prev.length + 1;
      const round = Math.ceil(pickNumber / teams.length);
      const teamIndex = teamOnClock(pickNumber, teams.length);
      const next: Pick = {
        pickNumber,
        round,
        teamIndex,
        team: teams[teamIndex],
        fighter,
      };
      const newPicks = [...prev, next];
      if (newPicks.length >= totalPicks) {
        setPhase('complete');
      }
      return newPicks;
    });
    setSecondsLeft(pickClockSeconds);
  };

  // ── Reset timer whenever a pick is made (or drafting starts) ────────────
  useEffect(() => {
    if (phase === 'drafting') setSecondsLeft(pickClockSeconds);
  }, [picks.length, phase, pickClockSeconds]);

  // ── User clock ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'drafting' || !isUserTurn) return;
    if (secondsLeft <= 0) {
      // Auto-pick best available for the user
      const bestPool = pool.filter((f) => !draftedIds.has(f.id));
      const userPicks = picks
        .filter((p) => p.teamIndex === userTeamIndex)
        .map((p) => p.fighter);
      const choice = aiSelect(bestPool, userPicks);
      if (choice) makePick(choice);
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, isUserTurn, secondsLeft, draftedIds, pool, picks, userTeamIndex]);

  // ── AI picks ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'drafting' || isUserTurn || onClockIndex < 0) return;
    const t = setTimeout(() => {
      const aiTeamPicks = picks
        .filter((p) => p.teamIndex === onClockIndex)
        .map((p) => p.fighter);
      const remaining = pool.filter((f) => !draftedIds.has(f.id));
      const choice = aiSelect(remaining, aiTeamPicks);
      if (choice) makePick(choice);
    }, 700);
    return () => clearTimeout(t);
  }, [phase, isUserTurn, onClockIndex, picks, draftedIds, pool]);

  // ── User roster summaries ──────────────────────────────────────────────
  const myPicks = picks.filter((p) => p.teamIndex === userTeamIndex);
  const myFighters = myPicks.map((p) => p.fighter);

  const slotSummary = SLOT_BUCKETS.map((b) => {
    const count = myFighters.filter((f) => b.matches(f)).length;
    return { label: b.label, count, need: b.need };
  });
  // FLEX: anyone not "consumed" by a positional slot. Simple count of
  // remaining fighters past the positional needs.
  const positionalCovered = SLOT_BUCKETS.reduce(
    (sum, b) => sum + Math.min(b.need, myFighters.filter((f) => b.matches(f)).length),
    0
  );
  const flexCount = Math.max(0, myFighters.length - positionalCovered);
  const flexFilled = Math.min(FLEX_NEED, flexCount);

  const teamSummary = useMemo(() => {
    const m = new Map<string, number>();
    myFighters.forEach((f) => {
      m.set(f.team, (m.get(f.team) ?? 0) + 1);
    });
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([team, count]) => ({ team, count }));
  }, [myFighters]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* Hero strip: round / pick / clock */}
      <div className="fantasy-hero fantasy-hero--compact">
        <div>
          <div
            className="tbl-eyebrow"
            style={{
              color: isUserTurn
                ? 'var(--tbl-accent-bright)'
                : 'rgba(244,237,224,0.6)',
            }}
          >
            {phase === 'pre'
              ? 'Mock Draft · 8 teams · 10 rounds · 60-sec clock'
              : phase === 'complete'
              ? 'Draft Complete'
              : isUserTurn
              ? 'You are on the clock'
              : `${teamOnClockName} on the clock`}
          </div>
          <div className="tbl-display fantasy-hero__title">
            {phase === 'complete'
              ? 'Final Boards'
              : `Round ${currentRound} · Pick ${currentPickNumber}`}
          </div>
          <div className="fantasy-hero__sub">
            of {totalPicks} total · {teams.length} teams · Snake order
          </div>
        </div>
        <div className="fantasy-draft-clock">
          <div className="fantasy-draft-clock__label">Clock</div>
          <div className="tbl-display fantasy-draft-clock__time">
            {phase === 'pre' || phase === 'complete'
              ? '—'
              : isUserTurn
              ? `0:${String(secondsLeft).padStart(2, '0')}`
              : 'AI…'}
          </div>
        </div>
      </div>

      <div className="fantasy-body">
        {/* Pre-draft start gate */}
        {phase === 'pre' && (
          <section className="fantasy-section">
            <div
              className="fantasy-cta-card"
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div className="tbl-eyebrow">Start Mock Draft</div>
              <div className="tbl-display" style={{ fontSize: 28, lineHeight: 1 }}>
                Ready to roll
              </div>
              <p className="fantasy-cta-card__copy">
                You&apos;ll draft from pick #{userTeamIndex + 1} in an
                8-team snake. AI teams pick automatically (~1s each). Your
                clock is {pickClockSeconds}s — if it hits zero we auto-pick the
                best available for you.
              </p>
              <div>
                <button
                  type="button"
                  className="fantasy-btn fantasy-btn--primary"
                  onClick={() => setPhase('drafting')}
                >
                  Start mock draft →
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Snake board */}
        <section className="fantasy-section">
          <div className="tbl-section-rule">
            <span>Draft Order · Round {currentRound}</span>
            <span>{phase === 'complete' ? 'Done' : 'Snake'}</span>
          </div>
          <div className="fantasy-draft-board">
            {teams.map((team, i) => {
              const pickThisRound =
                currentRound % 2 === 1
                  ? (currentRound - 1) * teams.length + i + 1
                  : currentRound * teams.length - i;
              const isPast = pickThisRound < currentPickNumber;
              const isNow =
                phase === 'drafting' && pickThisRound === currentPickNumber;
              const isYou = i === userTeamIndex;
              return (
                <div
                  key={team}
                  className={`fantasy-draft-board__cell${
                    isNow ? ' is-now' : isPast ? ' is-past' : ''
                  }`}
                  style={
                    isYou
                      ? { borderColor: 'var(--tbl-accent)', borderWidth: 2 }
                      : undefined
                  }
                >
                  <div className="fantasy-draft-board__pick">#{pickThisRound}</div>
                  <div className="fantasy-draft-board__team">{team}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Main 2-column grid: pool left, my roster right */}
        <div className="fantasy-draft-grid">
          {/* Available pool */}
          <section className="fantasy-section fantasy-draft-grid__main">
            <div className="tbl-section-rule">
              <span>Available · {availableSorted.length} fighters</span>
              <span>Live ranked</span>
            </div>
            <div className="fantasy-draft-filters">
              <input
                className="fantasy-input"
                placeholder="Search fighter…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="fantasy-select"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
              >
                <option value="">All weights</option>
                {allClasses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                className="fantasy-select"
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
              >
                <option value="">All genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
              <select
                className="fantasy-select"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
              >
                <option value="projected">Sort: Projected</option>
                <option value="avg">Sort: Season avg</option>
                <option value="owned">Sort: Ownership</option>
                <option value="name">Sort: Name</option>
              </select>
            </div>
            <div className="fantasy-table-wrap">
              <table className="fantasy-table">
                <thead>
                  <tr>
                    <th>Fighter</th>
                    <th>Team</th>
                    <th>Class</th>
                    <th className="num">Proj</th>
                    <th className="num">Avg</th>
                    <th className="num">Own%</th>
                    <th className="num">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {availableSorted.slice(0, 80).map((f) => (
                    <tr key={f.id}>
                      <td>
                        <span className="fantasy-table__team">{f.name}</span>
                      </td>
                      <td className="muted">{f.city}</td>
                      <td className="muted">{f.weightClass}</td>
                      <td className="num mono">{f.projected.toFixed(1)}</td>
                      <td className="num mono">{f.avg.toFixed(1)}</td>
                      <td className="num mono">{f.owned}%</td>
                      <td className="num">
                        <button
                          type="button"
                          className="fantasy-btn fantasy-btn--primary fantasy-btn--small"
                          disabled={!isUserTurn}
                          onClick={() => makePick(f)}
                          style={{ opacity: isUserTurn ? 1 : 0.4 }}
                        >
                          Draft
                        </button>
                      </td>
                    </tr>
                  ))}
                  {availableSorted.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: 24, textAlign: 'center' }} className="muted">
                        No fighters match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Right rail: My roster + recent picks */}
          <aside className="fantasy-draft-grid__side">
            <section className="fantasy-section">
              <div className="tbl-section-rule">
                <span>Your Roster · {myFighters.length}/{rounds}</span>
              </div>

              {/* Slot fill */}
              <div className="fantasy-roster-slots">
                {slotSummary.map((s) => {
                  const filled = Math.min(s.need, s.count);
                  return (
                    <div
                      key={s.label}
                      className="fantasy-roster-slot"
                      data-filled={filled >= s.need ? 'true' : 'false'}
                    >
                      <span className="fantasy-roster-slot__label">{s.label}</span>
                      <span className="fantasy-roster-slot__count">
                        {filled}/{s.need}
                      </span>
                    </div>
                  );
                })}
                <div
                  className="fantasy-roster-slot"
                  data-filled={flexFilled >= FLEX_NEED ? 'true' : 'false'}
                >
                  <span className="fantasy-roster-slot__label">FLEX</span>
                  <span className="fantasy-roster-slot__count">
                    {flexFilled}/{FLEX_NEED}
                  </span>
                </div>
                <div className="fantasy-roster-slot">
                  <span className="fantasy-roster-slot__label">Bench</span>
                  <span className="fantasy-roster-slot__count">
                    {Math.max(0, myFighters.length - 7)}/{rounds - 7}
                  </span>
                </div>
              </div>

              {/* Team breakdown */}
              {teamSummary.length > 0 && (
                <>
                  <div
                    className="tbl-eyebrow"
                    style={{ marginTop: 14, marginBottom: 8 }}
                  >
                    By TBL Team
                  </div>
                  <div className="fantasy-roster-teams">
                    {teamSummary.map((t) => (
                      <div key={t.team} className="fantasy-roster-team">
                        <span className="fantasy-roster-team__name">{t.team}</span>
                        <span className="fantasy-roster-team__count">{t.count}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* My picks list */}
              <div className="tbl-eyebrow" style={{ marginTop: 14, marginBottom: 8 }}>
                Picks
              </div>
              {myPicks.length === 0 ? (
                <div className="fantasy-empty" style={{ padding: 14, fontSize: 11 }}>
                  No picks yet. Wait for your turn.
                </div>
              ) : (
                <div className="fantasy-pick-log">
                  {myPicks
                    .slice()
                    .reverse()
                    .map((p) => (
                      <div
                        key={p.pickNumber}
                        className="fantasy-pick-log__row"
                      >
                        <div className="fantasy-pick-log__num">
                          R{p.round}·#{p.pickNumber}
                        </div>
                        <div>
                          <div className="fantasy-pick-log__name">
                            {p.fighter.name}
                          </div>
                          <div className="fantasy-pick-log__meta">
                            {p.fighter.city} · {p.fighter.weightClass}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </section>

            <section className="fantasy-section">
              <div className="tbl-section-rule">
                <span>Recent Picks · All Teams</span>
              </div>
              {picks.length === 0 ? (
                <div className="fantasy-empty" style={{ padding: 14, fontSize: 11 }}>
                  Draft hasn&apos;t started.
                </div>
              ) : (
                <div className="fantasy-pick-log">
                  {picks
                    .slice()
                    .reverse()
                    .slice(0, 12)
                    .map((p) => (
                      <div key={p.pickNumber} className="fantasy-pick-log__row">
                        <div className="fantasy-pick-log__num">
                          R{p.round}·#{p.pickNumber}
                        </div>
                        <div>
                          <div className="fantasy-pick-log__name">
                            {p.fighter.name}
                          </div>
                          <div className="fantasy-pick-log__meta">
                            {p.team} · {p.fighter.weightClass}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </section>
          </aside>
        </div>

        {/* Complete state */}
        {phase === 'complete' && (
          <section className="fantasy-section">
            <div className="fantasy-cta-card">
              <div className="tbl-eyebrow">Mock Draft Complete</div>
              <div className="tbl-display" style={{ fontSize: 28, lineHeight: 1 }}>
                Roster locked
              </div>
              <p className="fantasy-cta-card__copy">
                You drafted {myFighters.length} fighters across{' '}
                {teamSummary.length} TBL clubs. Head to the team page to set
                your starting lineup, or run another mock to compare boards.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="fantasy-btn fantasy-btn--primary"
                  onClick={() => {
                    setPicks([]);
                    setSecondsLeft(pickClockSeconds);
                    setPhase('drafting');
                  }}
                >
                  Run another mock
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
