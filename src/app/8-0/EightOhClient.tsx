'use client';

// src/app/8-0/EightOhClient.tsx
// The interactive "/8-0" game. Two versions, chosen on the intro screen:
//   • Stats shown   — fighter cards display net points / NPPR / W-L / WAR while picking.
//   • Stats hidden   — a blind challenge; stats are revealed only on the result screen.
//
// Flow: intro → picking (12 rounds; each round deals a random team and you pick
// one of its fighters to fill an open weight-class slot) → result (simulate an
// 8-game regular season and report the record; 8-0 is perfect).

import { useCallback, useMemo, useState } from 'react';
import { FighterPortrait } from '@/components/FighterPortrait';
import { getTeamLogoPath, getTeamColor } from '@/lib/teams';
import {
  simulateSeason,
  type GameData,
  type GameFighter,
  type Slot,
  type SeasonResult,
} from '@/lib/eightOh';

type Phase = 'intro' | 'picking' | 'result';

interface Props {
  game: GameData;
}

export function EightOhClient({ game }: Props) {
  const { slots, fighters, opponents } = game;

  const [phase, setPhase] = useState<Phase>('intro');
  const [statsVisible, setStatsVisible] = useState(true);
  // slot id → picked fighter
  const [roster, setRoster] = useState<Record<string, GameFighter>>({});
  const [taken, setTaken] = useState<Set<string>>(() => new Set());
  const [currentTeam, setCurrentTeam] = useState<string | null>(null);
  const [result, setResult] = useState<SeasonResult | null>(null);

  const fightersByTeam = useMemo(() => {
    const map = new Map<string, GameFighter[]>();
    for (const f of fighters) {
      if (!f.teamSlug) continue;
      const arr = map.get(f.teamSlug);
      if (arr) arr.push(f);
      else map.set(f.teamSlug, [f]);
    }
    return map;
  }, [fighters]);

  const openSlots = useMemo(
    () => slots.filter((s) => !roster[s.id]),
    [slots, roster],
  );
  const openSlotIds = useMemo(() => new Set(openSlots.map((s) => s.id)), [openSlots]);
  const filledCount = slots.length - openSlots.length;

  /** Fighters on `teamSlug` that are un-taken and fit at least one open slot. */
  const eligibleFor = useCallback(
    (teamSlug: string | null): GameFighter[] => {
      const source = teamSlug ? (fightersByTeam.get(teamSlug) ?? []) : fighters;
      return source.filter(
        (f) => !taken.has(f.slug) && f.slotIds.some((id) => openSlotIds.has(id)),
      );
    },
    [fightersByTeam, fighters, taken, openSlotIds],
  );

  /** Teams that still have at least one pickable fighter for the open slots. */
  const dealableTeams = useCallback(
    (openIds: Set<string>, takenSet: Set<string>): string[] => {
      const out: string[] = [];
      for (const [teamSlug, roster2] of fightersByTeam) {
        if (
          roster2.some(
            (f) => !takenSet.has(f.slug) && f.slotIds.some((id) => openIds.has(id)),
          )
        ) {
          out.push(teamSlug);
        }
      }
      return out;
    },
    [fightersByTeam],
  );

  const dealTeam = useCallback(
    (openIds: Set<string>, takenSet: Set<string>) => {
      const teams = dealableTeams(openIds, takenSet);
      if (teams.length === 0) {
        // Fallback: no single team can fill a remaining slot — open the pick to
        // any team so the roster can always be completed. (Practically never hit.)
        setCurrentTeam(null);
        return;
      }
      setCurrentTeam(teams[Math.floor(Math.random() * teams.length)]);
    },
    [dealableTeams],
  );

  const start = useCallback(
    (visible: boolean) => {
      setStatsVisible(visible);
      setRoster({});
      setTaken(new Set());
      setResult(null);
      setPhase('picking');
      dealTeam(new Set(slots.map((s) => s.id)), new Set());
    },
    [dealTeam, slots],
  );

  const reset = useCallback(() => {
    setPhase('intro');
    setRoster({});
    setTaken(new Set());
    setCurrentTeam(null);
    setResult(null);
  }, []);

  const pick = useCallback(
    (f: GameFighter) => {
      // Assign to the first open slot (canonical order) this fighter can fill.
      const slot = slots.find((s) => !roster[s.id] && f.slotIds.includes(s.id));
      if (!slot) return;

      const nextRoster = { ...roster, [slot.id]: f };
      const nextTaken = new Set(taken);
      nextTaken.add(f.slug);
      setRoster(nextRoster);
      setTaken(nextTaken);

      const remaining = slots.filter((s) => !nextRoster[s.id]);
      if (remaining.length === 0) {
        const picked = slots.map((s) => nextRoster[s.id]);
        setResult(simulateSeason(picked, opponents));
        setCurrentTeam(null);
        setPhase('result');
      } else {
        dealTeam(new Set(remaining.map((s) => s.id)), nextTaken);
      }
    },
    [slots, roster, taken, opponents, dealTeam],
  );

  if (phase === 'intro') {
    return <Intro slotCount={slots.length} onStart={start} />;
  }

  if (phase === 'result' && result) {
    return (
      <Result
        slots={slots}
        roster={roster}
        result={result}
        onReset={reset}
      />
    );
  }

  // Picking
  const choices = eligibleFor(currentTeam);
  const teamColor = currentTeam ? getTeamColor(currentTeam) : '';

  return (
    <main className="eo-page">
      <header className="eo-head">
        <h1 className="eo-title">
          8<span className="eo-title__dash">–</span>0
        </h1>
        <p className="eo-sub">
          {statsVisible ? 'Stats shown' : 'Blind pick'} · Pick {filledCount + 1} of {slots.length}
        </p>
        <div className="eo-progress" aria-hidden>
          <div
            className="eo-progress__bar"
            style={{ width: `${(filledCount / slots.length) * 100}%` }}
          />
        </div>
      </header>

      <section className="eo-picker">
        <div className="eo-picker__team" style={teamColor ? { borderColor: teamColor } : undefined}>
          {currentTeam ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="eo-picker__logo" src={getTeamLogoPath(currentTeam)} alt="" />
              <div>
                <div className="eo-picker__eyebrow">You&apos;re on the clock</div>
                <div className="eo-picker__teamname">{choices[0]?.team ?? currentTeam}</div>
              </div>
            </>
          ) : (
            <div className="eo-picker__teamname">Pick any available fighter</div>
          )}
        </div>

        <div className="eo-grid">
          {choices.map((f) => (
            <button key={f.slug} className="eo-fighter" onClick={() => pick(f)}>
              <FighterPortrait
                slug={f.slug}
                teamLogoSrc={getTeamLogoPath(f.teamSlug)}
                alt={f.name}
                className="eo-fighter__img"
              />
              <div className="eo-fighter__name">{f.name}</div>
              <div className="eo-fighter__class">
                {f.classes.join(' / ')} · {f.gender === 'Female' ? 'F' : 'M'}
              </div>
              {statsVisible && (
                <div className="eo-fighter__stats">
                  <span>{f.record}</span>
                  <span>{f.netPts.toFixed(1)} NP</span>
                  <span>{f.nppr.toFixed(2)} NPPR</span>
                  <span>{f.war.toFixed(1)} WAR</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </section>

      <RosterBoard slots={slots} roster={roster} statsVisible={statsVisible} compact />
    </main>
  );
}

// ─── Intro ─────────────────────────────────────────────────────────────────

function Intro({ slotCount, onStart }: { slotCount: number; onStart: (visible: boolean) => void }) {
  return (
    <main className="eo-page eo-intro">
      <h1 className="eo-title eo-title--xl">
        8<span className="eo-title__dash">–</span>0
      </h1>
      <p className="eo-lede">
        You&apos;ll be dealt a random team {slotCount} times. Each time, pick one of its fighters to fill
        a weight-class slot — no fighter twice — until your {slotCount}-fighter roster is complete.
        Then we run an 8-game regular season. Can you go undefeated?
      </p>
      <div className="eo-modes">
        <button className="eo-mode" onClick={() => onStart(true)}>
          <span className="eo-mode__title">Stats shown</span>
          <span className="eo-mode__desc">
            See net points, NPPR, record and WAR while you pick. Play the odds.
          </span>
          <span className="eo-btn eo-btn--primary eo-mode__cta">Play with stats</span>
        </button>
        <button className="eo-mode" onClick={() => onStart(false)}>
          <span className="eo-mode__title">Blind pick</span>
          <span className="eo-mode__desc">
            No numbers — just names, teams and faces. Stats revealed at the end.
          </span>
          <span className="eo-btn eo-btn--ghost eo-mode__cta">Play blind</span>
        </button>
      </div>
    </main>
  );
}

// ─── Roster board ──────────────────────────────────────────────────────────

function RosterBoard({
  slots,
  roster,
  statsVisible,
  compact,
}: {
  slots: Slot[];
  roster: Record<string, GameFighter>;
  statsVisible: boolean;
  compact?: boolean;
}) {
  return (
    <section className={`eo-board${compact ? ' eo-board--compact' : ''}`}>
      {slots.map((s) => {
        const f = roster[s.id];
        return (
          <div key={s.id} className={`eo-slot${f ? ' eo-slot--filled' : ''}`}>
            <div className="eo-slot__label">{s.label}</div>
            {f ? (
              <div className="eo-slot__fighter">
                <FighterPortrait
                  slug={f.slug}
                  teamLogoSrc={getTeamLogoPath(f.teamSlug)}
                  alt={f.name}
                  className="eo-slot__img"
                />
                <div className="eo-slot__meta">
                  <div className="eo-slot__name">{f.name}</div>
                  <div className="eo-slot__team">{f.city}</div>
                  {statsVisible && (
                    <div className="eo-slot__stats">
                      {f.record} · {f.netPts.toFixed(1)} NP · {f.nppr.toFixed(2)} NPPR
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="eo-slot__empty">Empty</div>
            )}
          </div>
        );
      })}
    </section>
  );
}

// ─── Result ────────────────────────────────────────────────────────────────

function Result({
  slots,
  roster,
  result,
  onReset,
}: {
  slots: Slot[];
  roster: Record<string, GameFighter>;
  result: SeasonResult;
  onReset: () => void;
}) {
  return (
    <main className="eo-page eo-result">
      <header className="eo-result__head">
        <div className="eo-result__eyebrow">Your regular season</div>
        <div className={`eo-record${result.perfect ? ' eo-record--perfect' : ''}`}>
          {result.record}
        </div>
        <p className="eo-result__line">
          {result.perfect
            ? 'Undefeated. A perfect 8-0 season.'
            : `${result.wins} ${result.wins === 1 ? 'win' : 'wins'}, ${result.losses} ${
                result.losses === 1 ? 'loss' : 'losses'
              }. Team rating ${result.yourTotal}.`}
        </p>
      </header>

      <section className="eo-games">
        <h2 className="eo-section-title">Game log</h2>
        {result.games.map((g, i) => (
          <div key={i} className={`eo-game${g.won ? ' eo-game--w' : ' eo-game--l'}`}>
            <span className="eo-game__num">G{i + 1}</span>
            <span className="eo-game__opp">{g.opponentCity}</span>
            <span className="eo-game__score">
              {g.yourTotal.toFixed(1)} – {g.theirTotal.toFixed(1)}
            </span>
            <span className="eo-game__res">{g.won ? 'W' : 'L'}</span>
          </div>
        ))}
      </section>

      <section className="eo-reveal">
        <h2 className="eo-section-title">Your roster</h2>
        <RosterBoard slots={slots} roster={roster} statsVisible />
      </section>

      <button className="eo-btn eo-btn--primary eo-again" onClick={onReset}>
        Build another roster
      </button>
    </main>
  );
}
