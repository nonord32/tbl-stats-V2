'use client';

// src/app/8-0/EightOhClient.tsx
// The interactive "/8-0" game — a dark, standalone build-a-roster game.
//
// Two versions, chosen on the intro screen:
//   • Stats shown  — each fighter row shows net points / NPPR / WAR / record while picking.
//   • Blind pick   — no numbers while picking; stats revealed on the result screen.
//
// Flow: intro → picking (each round deals a random team; pick one of its fighters — shown as a
// row list, no photos — to fill an open weight-class slot) → result (simulate an 8-game regular
// season and report the record; 8-0 is perfect).
//
// Fighters who fought in multiple weight classes can be placed in either eligible slot (you
// choose on pick) and moved between eligible slots afterward from the roster board.

import { useCallback, useMemo, useState } from 'react';
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
  // Fighter slug whose weight-class chooser is expanded (dual-class pick).
  const [choosing, setChoosing] = useState<string | null>(null);

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

  const slotById = useMemo(() => {
    const m = new Map<string, Slot>();
    for (const s of slots) m.set(s.id, s);
    return m;
  }, [slots]);

  const openSlotIds = useMemo(() => {
    const s = new Set<string>();
    for (const slot of slots) if (!roster[slot.id]) s.add(slot.id);
    return s;
  }, [slots, roster]);
  const filledCount = slots.length - openSlotIds.size;

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
      setChoosing(null);
      const teams = dealableTeams(openIds, takenSet);
      if (teams.length === 0) {
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
      setChoosing(null);
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
    setChoosing(null);
    setResult(null);
  }, []);

  /** Place a fighter into a specific slot, then advance (deal next team or finish). */
  const place = useCallback(
    (f: GameFighter, slotId: string) => {
      if (roster[slotId] || !f.slotIds.includes(slotId)) return;

      const nextRoster = { ...roster, [slotId]: f };
      const nextTaken = new Set(taken);
      nextTaken.add(f.slug);
      setRoster(nextRoster);
      setTaken(nextTaken);
      setChoosing(null);

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

  /** Click a pickable fighter row: pick directly if one open slot, else open the chooser. */
  const onPick = useCallback(
    (f: GameFighter, openEligible: string[]) => {
      if (openEligible.length === 1) place(f, openEligible[0]);
      else setChoosing((cur) => (cur === f.slug ? null : f.slug));
    },
    [place],
  );

  /** Move an already-placed multi-class fighter from one slot to another open eligible slot. */
  const moveFighter = useCallback(
    (fromId: string, toId: string) => {
      const f = roster[fromId];
      if (!f || roster[toId] || !f.slotIds.includes(toId)) return;
      const next = { ...roster };
      delete next[fromId];
      next[toId] = f;
      setRoster(next);
    },
    [roster],
  );

  if (phase === 'intro') {
    return <Intro slotCount={slots.length} onStart={start} />;
  }

  if (phase === 'result' && result) {
    return <Result slots={slots} roster={roster} result={result} onReset={reset} />;
  }

  // Picking — the dealt team's entire roster (pickable + greyed non-pickable).
  const teamFighters = currentTeam ? (fightersByTeam.get(currentTeam) ?? []) : fighters;
  const rows = teamFighters
    .map((f) => {
      const openEligible = f.slotIds.filter((id) => openSlotIds.has(id));
      const isTaken = taken.has(f.slug);
      return { f, openEligible, isTaken, pickable: !isTaken && openEligible.length > 0 };
    })
    // Pickable first, then by rating (a light, useful default order).
    .sort((a, b) => Number(b.pickable) - Number(a.pickable) || b.f.rating - a.f.rating);

  const teamColor = currentTeam ? getTeamColor(currentTeam) : '';
  const teamName = teamFighters[0]?.team ?? currentTeam ?? '';

  return (
    <div className="eo-page eo-root">
      <header className="eo-head">
        <h1 className="eo-title">
          8<span className="eo-title__dash">–</span>0
        </h1>
        <p className="eo-sub">
          {statsVisible ? 'Stats shown' : 'Blind pick'} · Pick {filledCount + 1} of {slots.length}
        </p>
        <div className="eo-progress" aria-hidden>
          <div className="eo-progress__bar" style={{ width: `${(filledCount / slots.length) * 100}%` }} />
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
                <div className="eo-picker__teamname">{teamName}</div>
              </div>
            </>
          ) : (
            <div className="eo-picker__teamname">Pick any available fighter</div>
          )}
        </div>

        <div className="eo-list">
          {rows.map(({ f, openEligible, isTaken, pickable }) => {
            const expanded = choosing === f.slug;
            return (
              <div key={f.slug} className={`eo-row${pickable ? '' : ' eo-row--disabled'}`}>
                <button
                  type="button"
                  className="eo-row__main"
                  disabled={!pickable}
                  aria-expanded={pickable && openEligible.length > 1 ? expanded : undefined}
                  onClick={() => pickable && onPick(f, openEligible)}
                >
                  <span className="eo-row__id">
                    <span className="eo-row__name">{f.name}</span>
                    <span className="eo-row__classes">{f.classes.join(' · ')}</span>
                    <span className="eo-row__meta">
                      {f.city} · {f.gender === 'Female' ? 'F' : 'M'}
                      {!pickable && (
                        <span className="eo-row__tag">{isTaken ? 'Rostered' : 'Slot filled'}</span>
                      )}
                      {pickable && openEligible.length > 1 && (
                        <span className="eo-row__tag eo-row__tag--pick">Choose class</span>
                      )}
                    </span>
                  </span>
                  {statsVisible && (
                    <span className="eo-row__stats">
                      <Stat v={f.netPts.toFixed(1)} l="NET PTS" />
                      <Stat v={f.nppr.toFixed(2)} l="NPPR" />
                      <Stat v={f.war.toFixed(1)} l="WAR" />
                      <Stat v={f.record} l="REC" />
                    </span>
                  )}
                </button>

                {pickable && expanded && openEligible.length > 1 && (
                  <div className="eo-row__choose">
                    <span className="eo-row__choose-label">Fill slot:</span>
                    {openEligible.map((id) => (
                      <button key={id} type="button" className="eo-chip" onClick={() => place(f, id)}>
                        {slotById.get(id)?.label ?? id}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <RosterBoard
        slots={slots}
        roster={roster}
        statsVisible={statsVisible}
        openSlotIds={openSlotIds}
        onMove={moveFighter}
        compact
      />
    </div>
  );
}

function Stat({ v, l }: { v: string; l: string }) {
  return (
    <span className="eo-stat">
      <span className="eo-stat__v">{v}</span>
      <span className="eo-stat__l">{l}</span>
    </span>
  );
}

// ─── Intro ─────────────────────────────────────────────────────────────────

function Intro({ slotCount, onStart }: { slotCount: number; onStart: (visible: boolean) => void }) {
  return (
    <div className="eo-page eo-root eo-intro">
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
            See net points, NPPR, WAR and record while you pick. Play the odds.
          </span>
          <span className="eo-btn eo-btn--primary eo-mode__cta">Play with stats</span>
        </button>
        <button className="eo-mode" onClick={() => onStart(false)}>
          <span className="eo-mode__title">Blind pick</span>
          <span className="eo-mode__desc">
            No numbers — just names and teams. Stats revealed at the end.
          </span>
          <span className="eo-btn eo-btn--ghost eo-mode__cta">Play blind</span>
        </button>
      </div>
    </div>
  );
}

// ─── Roster board ──────────────────────────────────────────────────────────

function RosterBoard({
  slots,
  roster,
  statsVisible,
  openSlotIds,
  onMove,
  compact,
}: {
  slots: Slot[];
  roster: Record<string, GameFighter>;
  statsVisible: boolean;
  openSlotIds?: Set<string>;
  onMove?: (fromId: string, toId: string) => void;
  compact?: boolean;
}) {
  return (
    <section className={`eo-board${compact ? ' eo-board--compact' : ''}`}>
      {slots.map((s) => {
        const f = roster[s.id];
        // Other eligible slots this fighter could move to that are currently open.
        const moveTargets =
          f && openSlotIds && onMove
            ? f.slotIds.filter((id) => id !== s.id && openSlotIds.has(id))
            : [];
        return (
          <div key={s.id} className={`eo-slot${f ? ' eo-slot--filled' : ''}`}>
            <div className="eo-slot__label">{s.label}</div>
            {f ? (
              <div className="eo-slot__body">
                <div className="eo-slot__name">{f.name}</div>
                <div className="eo-slot__team">{f.city}</div>
                {statsVisible && (
                  <div className="eo-slot__stats">
                    {f.record} · {f.netPts.toFixed(1)} NP · {f.nppr.toFixed(2)} NPPR
                  </div>
                )}
                {moveTargets.length > 0 && (
                  <div className="eo-slot__move">
                    {moveTargets.map((id) => {
                      const label = slots.find((x) => x.id === id)?.weightClass ?? id;
                      return (
                        <button
                          key={id}
                          type="button"
                          className="eo-move-btn"
                          onClick={() => onMove!(s.id, id)}
                          title={`Move ${f.name} to ${label}`}
                        >
                          → {label}
                        </button>
                      );
                    })}
                  </div>
                )}
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
    <div className="eo-page eo-root eo-result">
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

      <section className="eo-reveal">
        <h2 className="eo-section-title">Your roster</h2>
        <RosterBoard slots={slots} roster={roster} statsVisible />
      </section>

      <button className="eo-btn eo-btn--primary eo-again" onClick={onReset}>
        Build another roster
      </button>
    </div>
  );
}
