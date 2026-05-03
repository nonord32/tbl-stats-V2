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
import Link from 'next/link';
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
    if (eligible.length > 0) return eligible[0]; // already best-first
  }
  // Otherwise best available
  return available[0];
}

type SortKey = 'avg' | 'owned' | 'name';

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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('avg');

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
          case 'owned':     return b.owned - a.owned;
          case 'name':      return a.name.localeCompare(b.name);
          case 'avg':
          default:          return b.avg - a.avg;
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

  // ── Persist roster on draft completion ────────────────────────────────
  // When the draft transitions to 'complete' (and we haven't already
  // saved this draft), POST the user's picks to /api/fantasy/draft so
  // /fantasy/team can read them back across reloads / devices.
  useEffect(() => {
    if (phase !== 'complete') return;
    if (saveStatus !== 'idle') return;
    const slugs = picks
      .filter((p) => p.teamIndex === userTeamIndex)
      .map((p) => p.fighter.id);
    if (slugs.length === 0) return;
    setSaveStatus('saving');
    setSaveError(null);
    fetch('/api/fantasy/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fighter_slugs: slugs }),
    })
      .then(async (r) => {
        if (r.ok) {
          setSaveStatus('saved');
          return;
        }
        const json = await r.json().catch(() => ({}));
        setSaveStatus('error');
        setSaveError(
          r.status === 401
            ? 'Sign in first to save your roster.'
            : json.error ?? `Save failed (${r.status})`
        );
      })
      .catch(() => {
        setSaveStatus('error');
        setSaveError('Network error saving roster.');
      });
  }, [phase, saveStatus, picks, userTeamIndex]);

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
    <div className="fv2-body">
      {/* Hero strip: round / pick / clock */}
      <section className="fv2-hero">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div
              className="fv2-hero__eyebrow"
              style={{
                color: isUserTurn
                  ? 'var(--fv2-accent-bright)'
                  : 'var(--fv2-text-3)',
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
            <div className="fv2-hero__title">
              {phase === 'complete'
                ? 'Final Boards'
                : `Round ${currentRound} · Pick ${currentPickNumber}`}
            </div>
            <div className="fv2-hero__sub">
              of {totalPicks} total · {teams.length} teams · snake order
            </div>
          </div>
          <div className="fv2-draft-clock">
            <div className="fv2-draft-clock__label">Clock</div>
            <div
              className={`fv2-draft-clock__time${
                isUserTurn ? ' fv2-draft-clock__time--live' : ''
              }`}
            >
              {phase === 'pre' || phase === 'complete'
                ? '—'
                : isUserTurn
                ? `0:${String(secondsLeft).padStart(2, '0')}`
                : 'AI…'}
            </div>
          </div>
        </div>
      </section>

      <div>
        {/* Pre-draft start gate */}
        {phase === 'pre' && (
          <section className="fv2-section">
            <div className="fv2-card" style={{ padding: 22 }}>
              <div className="fv2-card__eyebrow">Start mock draft</div>
              <div className="fv2-card__title">Ready to roll</div>
              <p className="fv2-card__sub">
                You&apos;ll draft from pick #{userTeamIndex + 1} in an 8-team
                snake. AI teams pick automatically (~1s each). Your clock is{' '}
                {pickClockSeconds}s — if it hits zero we auto-pick the best
                available for you.
              </p>
              <div style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="fv2-btn fv2-btn--primary"
                  onClick={() => setPhase('drafting')}
                >
                  Start mock draft
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Snake board */}
        <section className="fv2-section">
          <div className="fv2-section-head">
            <span className="fv2-section-head__title">
              Draft order · Round {currentRound}
            </span>
            <span className="fv2-section-head__meta">
              {phase === 'complete' ? 'Done' : 'Snake'}
            </span>
          </div>
          <div className="fv2-draft-board">
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
                  className={`fv2-draft-board__cell${
                    isNow ? ' is-now' : isPast ? ' is-past' : ''
                  }${isYou ? ' is-you' : ''}`}
                >
                  <div className="fv2-draft-board__pick">#{pickThisRound}</div>
                  <div className="fv2-draft-board__team">{team}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Main 2-column grid: pool left, my roster right */}
        <div className="fv2-draft-grid">
          {/* Available pool */}
          <section className="fv2-section fv2-draft-grid__main">
            <div className="fv2-section-head">
              <span className="fv2-section-head__title">
                Available · {availableSorted.length} fighters
              </span>
              <span className="fv2-section-head__meta">live ranked</span>
            </div>
            <div className="fv2-filters">
              <input
                className="fv2-input"
                placeholder="Search fighter…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="fv2-select"
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
                className="fv2-select"
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
              >
                <option value="">All genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
              <select
                className="fv2-select"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
              >
                <option value="avg">Sort: Season avg</option>
                <option value="owned">Sort: Ownership</option>
                <option value="name">Sort: Name</option>
              </select>
            </div>
            <div className="fv2-table-wrap">
              <table className="fv2-table">
                <thead>
                  <tr>
                    <th className="fv2-col-left">Fighter</th>
                    <th className="fv2-col-left">Team</th>
                    <th className="fv2-col-left">Class</th>
                    <th>Avg</th>
                    <th>Own%</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {availableSorted.slice(0, 80).map((f) => (
                    <tr key={f.id}>
                      <td className="fv2-col-left">
                        <span className="fv2-table__name">{f.name}</span>
                      </td>
                      <td className="fv2-col-left" style={{ color: 'var(--fv2-text-3)' }}>
                        {f.city}
                      </td>
                      <td className="fv2-col-left" style={{ color: 'var(--fv2-text-3)' }}>
                        {f.weightClass}
                      </td>
                      <td>{f.avg.toFixed(1)}</td>
                      <td>{f.owned}%</td>
                      <td>
                        <button
                          type="button"
                          className={`fv2-action-btn${
                            isUserTurn ? ' fv2-action-btn--active' : ''
                          }`}
                          disabled={!isUserTurn}
                          onClick={() => makePick(f)}
                        >
                          Draft
                        </button>
                      </td>
                    </tr>
                  ))}
                  {availableSorted.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--fv2-text-3)' }}>
                        No fighters match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Right rail: My roster + recent picks */}
          <aside className="fv2-draft-grid__side">
            <section className="fv2-section">
              <div className="fv2-section-head">
                <span className="fv2-section-head__title">
                  Your roster · {myFighters.length}/{rounds}
                </span>
              </div>

              {/* Slot fill */}
              <div className="fv2-roster-slots">
                {slotSummary.map((s) => {
                  const filled = Math.min(s.need, s.count);
                  return (
                    <div
                      key={s.label}
                      className="fv2-roster-slot"
                      data-filled={filled >= s.need ? 'true' : 'false'}
                    >
                      <span className="fv2-roster-slot__label">{s.label}</span>
                      <span className="fv2-roster-slot__count">
                        {filled}/{s.need}
                      </span>
                    </div>
                  );
                })}
                <div
                  className="fv2-roster-slot"
                  data-filled={flexFilled >= FLEX_NEED ? 'true' : 'false'}
                >
                  <span className="fv2-roster-slot__label">FLEX</span>
                  <span className="fv2-roster-slot__count">
                    {flexFilled}/{FLEX_NEED}
                  </span>
                </div>
                <div className="fv2-roster-slot">
                  <span className="fv2-roster-slot__label">Bench</span>
                  <span className="fv2-roster-slot__count">
                    {Math.max(0, myFighters.length - 7)}/{rounds - 7}
                  </span>
                </div>
              </div>

              {/* Team breakdown */}
              {teamSummary.length > 0 && (
                <>
                  <div
                    className="fv2-section-head__title"
                    style={{ marginTop: 18, marginBottom: 8 }}
                  >
                    By TBL Team
                  </div>
                  <div className="fv2-roster-teams">
                    {teamSummary.map((t) => (
                      <div key={t.team} className="fv2-roster-team">
                        <span className="fv2-roster-team__name">{t.team}</span>
                        <span className="fv2-roster-team__count">{t.count}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* My picks list */}
              <div
                className="fv2-section-head__title"
                style={{ marginTop: 18, marginBottom: 8 }}
              >
                Picks
              </div>
              {myPicks.length === 0 ? (
                <div className="fv2-empty" style={{ padding: 14, fontSize: 11 }}>
                  No picks yet. Wait for your turn.
                </div>
              ) : (
                <div className="fv2-pick-log">
                  {myPicks
                    .slice()
                    .reverse()
                    .map((p) => (
                      <div
                        key={p.pickNumber}
                        className="fv2-pick-log__row"
                      >
                        <div className="fv2-pick-log__num">
                          R{p.round}·#{p.pickNumber}
                        </div>
                        <div>
                          <div className="fv2-pick-log__name">
                            {p.fighter.name}
                          </div>
                          <div className="fv2-pick-log__meta">
                            {p.fighter.city} · {p.fighter.weightClass}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </section>

            <section className="fv2-section">
              <div className="fv2-section-head">
                <span className="fv2-section-head__title">
                  Recent picks · all teams
                </span>
              </div>
              {picks.length === 0 ? (
                <div className="fv2-empty" style={{ padding: 14, fontSize: 11 }}>
                  Draft hasn&apos;t started.
                </div>
              ) : (
                <div className="fv2-pick-log">
                  {picks
                    .slice()
                    .reverse()
                    .slice(0, 12)
                    .map((p) => (
                      <div key={p.pickNumber} className="fv2-pick-log__row">
                        <div className="fv2-pick-log__num">
                          R{p.round}·#{p.pickNumber}
                        </div>
                        <div>
                          <div className="fv2-pick-log__name">
                            {p.fighter.name}
                          </div>
                          <div className="fv2-pick-log__meta">
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
          <section className="fv2-section">
            <div className="fv2-card" style={{ padding: 22 }}>
              <div className="fv2-card__eyebrow">Mock draft complete</div>
              <div className="fv2-card__title">Roster locked</div>
              <p className="fv2-card__sub">
                You drafted {myFighters.length} fighters across{' '}
                {teamSummary.length} TBL clubs.{' '}
                {saveStatus === 'saving' && <strong>Saving roster…</strong>}
                {saveStatus === 'saved' && (
                  <strong style={{ color: 'var(--fv2-positive)' }}>
                    ✓ Roster saved.
                  </strong>
                )}
                {saveStatus === 'error' && (
                  <strong style={{ color: 'var(--fv2-negative)' }}>
                    ⚠ {saveError ?? 'Save failed.'} You can still preview your
                    team but the next reload will re-roll.
                  </strong>
                )}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                {saveStatus === 'saved' && (
                  <Link
                    href="/fantasy/team"
                    className="fv2-btn fv2-btn--primary"
                  >
                    Open my team →
                  </Link>
                )}
                <button
                  type="button"
                  className={`fv2-btn ${
                    saveStatus === 'saved'
                      ? 'fv2-btn--ghost'
                      : 'fv2-btn--primary'
                  }`}
                  onClick={() => {
                    setPicks([]);
                    setSecondsLeft(pickClockSeconds);
                    setSaveStatus('idle');
                    setSaveError(null);
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
    </div>
  );
}
