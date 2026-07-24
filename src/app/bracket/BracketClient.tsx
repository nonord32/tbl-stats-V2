'use client';
// src/app/bracket/BracketClient.tsx
// Gazette-styled Bracket Challenge ballot. Signed-in users fill out the locked
// 8-team single-elimination bracket round by round; semifinal options are drawn
// from their own quarterfinal picks, the champion from their semifinal picks,
// plus a combined-final-score tiebreaker. Auto-saves on change. Once entries
// lock (1.5h after the first playoff game starts) this renders as a read-only
// scorecard grading each pick against the live results.

import { useEffect, useMemo, useRef, useState } from 'react';
import { getFullTeamName, getTeamLogoPathByName } from '@/lib/teams';
import type { Seed, Bracket } from '@/lib/playoffs';
import type { BracketEntry } from '@/types';
import {
  scoreBracketEntry,
  actualFinalTotal,
  QF_POINTS,
  SF_POINTS,
  CHAMP_POINTS,
  MAX_BRACKET_POINTS,
} from '@/lib/bracketScore';

interface BracketClientProps {
  seeds: Seed[];
  bracket: Bracket;
  entry: BracketEntry | null;
  open: boolean;
  lockISO: string | null;
}

// Which two QF slots feed each SF slot: QF0+QF1 → SF0, QF2+QF3 → SF1.
const SF_SOURCES: Record<number, [number, number]> = { 0: [0, 1], 1: [2, 3] };

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

export function BracketClient({ seeds, bracket, entry, open, lockISO }: BracketClientProps) {
  const now = useNow();

  // slug → Seed lookup for rendering any team by its slug.
  const bySlug = useMemo(() => {
    const m = new Map<string, Seed>();
    seeds.forEach((s) => m.set(s.team.slug, s));
    return m;
  }, [seeds]);

  // ── Prediction state ──────────────────────────────────────────────────────
  const [qf, setQf] = useState<string[]>(() => {
    const base = entry?.qf_winners ?? [];
    return [0, 1, 2, 3].map((i) => base[i] ?? '');
  });
  const [sf, setSf] = useState<string[]>(() => {
    const base = entry?.sf_winners ?? [];
    return [0, 1].map((i) => base[i] ?? '');
  });
  const [champ, setChamp] = useState<string>(entry?.champion ?? '');
  const [finalTotal, setFinalTotal] = useState<string>(
    entry?.final_total != null ? String(entry.final_total) : ''
  );

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<boolean>(!!entry);
  const [error, setError] = useState('');

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>(
    JSON.stringify({
      qf: entry?.qf_winners ?? [],
      sf: entry?.sf_winners ?? [],
      champ: entry?.champion ?? null,
      total: entry?.final_total ?? null,
    })
  );

  // Persist the current prediction (debounced). Only fires while entries are open.
  function scheduleSave(nextQf: string[], nextSf: string[], nextChamp: string, nextTotal: string) {
    if (!open) return;
    const totalNum = nextTotal.trim() === '' ? null : Number(nextTotal);
    const payload = {
      qf_winners: nextQf,
      sf_winners: nextSf,
      champion: nextChamp || null,
      final_total: totalNum != null && Number.isFinite(totalNum) ? Math.round(totalNum) : null,
    };
    const sig = JSON.stringify({
      qf: nextQf.filter(Boolean).length === 0 ? [] : nextQf,
      sf: nextSf.filter(Boolean).length === 0 ? [] : nextSf,
      champ: payload.champion,
      total: payload.final_total,
    });
    if (sig === lastSaved.current) return;
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      setError('');
      try {
        const res = await fetch('/api/bracket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) {
          setSaving(false);
          setError(json.error ?? 'Failed to save your bracket');
        } else {
          lastSaved.current = sig;
          setSaving(false);
          setSaved(true);
        }
      } catch {
        setSaving(false);
        setError('Network error. Please try again.');
      }
    }, 500);
  }

  // Clear any downstream picks that a change just invalidated, keeping the
  // prediction a valid chain (SF winner ∈ its QF winners; champ ∈ SF winners).
  function sanitize(nextQf: string[], nextSf: string[], nextChamp: string) {
    const sf2 = [...nextSf];
    ([0, 1] as const).forEach((sfi) => {
      const [a, b] = SF_SOURCES[sfi];
      const allowed = [nextQf[a], nextQf[b]].filter(Boolean);
      if (sf2[sfi] && !allowed.includes(sf2[sfi])) sf2[sfi] = '';
    });
    const finalists = [sf2[0], sf2[1]].filter(Boolean);
    const champ2 = nextChamp && !finalists.includes(nextChamp) ? '' : nextChamp;
    return { sf2, champ2 };
  }

  function pickQf(slot: number, slug: string) {
    if (!open) return;
    const nextQf = [...qf];
    nextQf[slot] = nextQf[slot] === slug ? '' : slug;
    const { sf2, champ2 } = sanitize(nextQf, sf, champ);
    setQf(nextQf);
    setSf(sf2);
    setChamp(champ2);
    scheduleSave(nextQf, sf2, champ2, finalTotal);
  }

  function pickSf(slot: number, slug: string) {
    if (!open) return;
    const nextSf = [...sf];
    nextSf[slot] = nextSf[slot] === slug ? '' : slug;
    const { sf2, champ2 } = sanitize(qf, nextSf, champ);
    setSf(sf2);
    setChamp(champ2);
    scheduleSave(qf, sf2, champ2, finalTotal);
  }

  function pickChamp(slug: string) {
    if (!open) return;
    const next = champ === slug ? '' : slug;
    setChamp(next);
    scheduleSave(qf, sf, next, finalTotal);
  }

  function onFinalTotal(v: string) {
    if (!open) return;
    const clean = v.replace(/[^0-9]/g, '').slice(0, 3);
    setFinalTotal(clean);
    scheduleSave(qf, sf, champ, clean);
  }

  // ── Participants for each round (from the user's own picks) ────────────────
  const qfPairs = bracket.qf.map((m) => [m.a, m.b] as [Seed | undefined, Seed | undefined]);
  const sfPairs: Array<[string, string]> = [
    [qf[0], qf[1]],
    [qf[2], qf[3]],
  ];
  const finalPair: [string, string] = [sf[0], sf[1]];

  // ── Scoring (locked view) ──────────────────────────────────────────────────
  const entryForScore: BracketEntry = {
    user_id: entry?.user_id ?? '',
    qf_winners: qf,
    sf_winners: sf,
    champion: champ || null,
    final_total: finalTotal.trim() === '' ? null : Number(finalTotal),
    created_at: entry?.created_at ?? '',
    updated_at: entry?.updated_at ?? '',
  };
  const score = scoreBracketEntry(entryForScore, bracket);
  const finalTotalActual = actualFinalTotal(bracket);

  const madeCount =
    qf.filter(Boolean).length + sf.filter(Boolean).length + (champ ? 1 : 0);
  const totalSlots = 7;
  const lockMs = lockISO ? new Date(lockISO).getTime() - now : null;
  const countdown = lockMs != null ? formatCountdown(lockMs) : null;

  const statusText = saving ? 'Saving…' : error ? error : saved ? 'Saved' : '';

  return (
    <>
      {/* ── Header band ─────────────────────────────────────────────────── */}
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
            Postseason · MegaBrawl IV
          </div>
          <div className="tbl-display" style={{ fontSize: 60, lineHeight: 0.95, marginTop: 8 }}>
            Bracket Challenge
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
            Pick every winner · 1 pt QF · 2 pt SF · 4 pt Final · Tiebreaker: final score
          </div>
        </div>

        <div
          style={{
            background: 'var(--tbl-ink)',
            color: 'var(--tbl-bg)',
            padding: '12px 18px',
            display: 'flex',
            gap: 22,
            alignItems: 'center',
            minWidth: 200,
          }}
        >
          <div>
            <div style={chipLabelStyle}>{open ? 'Filled' : 'Points'}</div>
            <div className="tbl-display" style={{ fontSize: 28, lineHeight: 1, marginTop: 2 }}>
              {open ? `${madeCount}/${totalSlots}` : `${score.points}/${MAX_BRACKET_POINTS}`}
            </div>
          </div>
          <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(244,237,224,0.25)' }} />
          <div>
            <div style={chipLabelStyle}>{open ? 'Entries lock' : 'Status'}</div>
            <div
              className="tbl-display"
              style={{ fontSize: 28, lineHeight: 1, marginTop: 2, color: 'var(--tbl-accent-bright)' }}
            >
              {open ? countdown ?? 'Open' : 'Locked'}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '26px 32px 56px', maxWidth: 760, margin: '0 auto' }}>
        {/* Save status / lock notice */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 18,
            fontFamily: 'var(--tbl-font-mono)',
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            fontWeight: 700,
            color: error ? 'var(--tbl-red)' : 'var(--tbl-ink-soft)',
          }}
        >
          <span>{open ? 'Auto-saves as you pick' : 'Entries are locked — grading live results'}</span>
          <span>{statusText}</span>
        </div>

        {/* Quarterfinals */}
        <RoundHeading label="Quarterfinals" note="1 point each" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
          {qfPairs.map(([a, b], i) => (
            <MatchupCard
              key={`qf-${i}`}
              teamA={seedTeam(a)}
              teamB={seedTeam(b)}
              selected={qf[i]}
              onPick={(slug) => pickQf(i, slug)}
              locked={!open}
              actualWinner={bracket.qf[i].status === 'played' ? bracket.qf[i].winnerSlug : undefined}
              pointsIfCorrect={QF_POINTS}
              bySlug={bySlug}
            />
          ))}
        </div>

        {/* Semifinals */}
        <RoundHeading label="Semifinals" note="2 points each" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
          {([0, 1] as const).map((i) => (
            <MatchupCard
              key={`sf-${i}`}
              teamA={slugTeam(sfPairs[i][0], bySlug)}
              teamB={slugTeam(sfPairs[i][1], bySlug)}
              selected={sf[i]}
              onPick={(slug) => pickSf(i, slug)}
              locked={!open}
              actualWinner={bracket.sf[i].status === 'played' ? bracket.sf[i].winnerSlug : undefined}
              pointsIfCorrect={SF_POINTS}
              bySlug={bySlug}
            />
          ))}
        </div>

        {/* Final */}
        <RoundHeading label="Final · MegaBrawl IV" note="4 points" />
        <div style={{ marginBottom: 22 }}>
          <MatchupCard
            teamA={slugTeam(finalPair[0], bySlug)}
            teamB={slugTeam(finalPair[1], bySlug)}
            selected={champ}
            onPick={(slug) => pickChamp(slug)}
            locked={!open}
            actualWinner={bracket.final.status === 'played' ? bracket.championSlug : undefined}
            pointsIfCorrect={CHAMP_POINTS}
            bySlug={bySlug}
          />
        </div>

        {/* Tiebreaker */}
        <div
          style={{
            border: '1.5px solid var(--tbl-ink)',
            background: 'var(--tbl-paper)',
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'var(--tbl-font-mono)',
                fontSize: 11,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                fontWeight: 700,
                color: 'var(--tbl-ink)',
              }}
            >
              Tiebreaker
            </div>
            <div
              style={{
                fontFamily: 'var(--tbl-font-mono)',
                fontSize: 11,
                color: 'var(--tbl-ink-soft)',
                marginTop: 4,
              }}
            >
              Combined final score of the Final (both teams)
            </div>
          </div>
          {open ? (
            <input
              inputMode="numeric"
              value={finalTotal}
              onChange={(e) => onFinalTotal(e.target.value)}
              placeholder="—"
              aria-label="Predicted combined final score"
              style={{
                width: 96,
                padding: '10px 12px',
                border: '1.5px solid var(--tbl-ink)',
                background: 'var(--tbl-bg)',
                fontFamily: 'var(--tbl-font-mono)',
                fontSize: 22,
                fontWeight: 700,
                textAlign: 'center',
                color: 'var(--tbl-ink)',
              }}
            />
          ) : (
            <div style={{ textAlign: 'right', fontFamily: 'var(--tbl-font-mono)' }}>
              <div className="tbl-display" style={{ fontSize: 26 }}>
                {finalTotal || '—'}
              </div>
              {finalTotalActual != null && (
                <div style={{ fontSize: 11, color: 'var(--tbl-ink-soft)', marginTop: 2 }}>
                  Actual {finalTotalActual}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
interface SlotTeam {
  slug: string;
  seed: number;
  name: string;
  logo: string;
}

function seedTeam(s: Seed | undefined): SlotTeam | null {
  if (!s) return null;
  return {
    slug: s.team.slug,
    seed: s.seed,
    name: getFullTeamName(s.team.slug),
    logo: getTeamLogoPathByName(s.team.team),
  };
}

function slugTeam(slug: string | undefined, bySlug: Map<string, Seed>): SlotTeam | null {
  if (!slug) return null;
  return seedTeam(bySlug.get(slug));
}

const chipLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--tbl-font-mono)',
  fontSize: 9,
  letterSpacing: '0.22em',
  fontWeight: 700,
  color: 'rgba(244,237,224,0.55)',
  textTransform: 'uppercase',
};

function RoundHeading({ label, note }: { label: string; note: string }) {
  return (
    <div className="tbl-section-rule">
      <span>{label}</span>
      <span>{note}</span>
    </div>
  );
}

function MatchupCard({
  teamA,
  teamB,
  selected,
  onPick,
  locked,
  actualWinner,
  pointsIfCorrect,
  bySlug,
}: {
  teamA: SlotTeam | null;
  teamB: SlotTeam | null;
  selected: string;
  onPick: (slug: string) => void;
  locked: boolean;
  actualWinner?: string;
  pointsIfCorrect: number;
  bySlug: Map<string, Seed>;
}) {
  const earned = !!actualWinner && !!selected && selected === actualWinner;
  const missed = locked && !!actualWinner && !!selected && selected !== actualWinner;

  return (
    <div
      style={{
        border: '1.5px solid var(--tbl-ink)',
        background: 'var(--tbl-bg)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
      }}
    >
      <TeamButton
        team={teamA}
        selected={!!selected && teamA?.slug === selected}
        onPick={onPick}
        locked={locked}
        isActualWinner={!!actualWinner && teamA?.slug === actualWinner}
        side="left"
      />
      <TeamButton
        team={teamB}
        selected={!!selected && teamB?.slug === selected}
        onPick={onPick}
        locked={locked}
        isActualWinner={!!actualWinner && teamB?.slug === actualWinner}
        side="right"
      />
      {locked && actualWinner && (
        <div
          style={{
            gridColumn: '1 / -1',
            borderTop: '1px solid var(--tbl-ink)',
            padding: '6px 12px',
            fontFamily: 'var(--tbl-font-mono)',
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            fontWeight: 700,
            color: earned ? 'var(--tbl-green)' : missed ? 'var(--tbl-red)' : 'var(--tbl-ink-soft)',
            textAlign: 'right',
          }}
        >
          {earned ? `+${pointsIfCorrect} pts` : missed ? '0 pts' : `${pointsIfCorrect} pts avail.`}
        </div>
      )}
    </div>
  );
}

function TeamButton({
  team,
  selected,
  onPick,
  locked,
  isActualWinner,
  side,
}: {
  team: SlotTeam | null;
  selected: boolean;
  onPick: (slug: string) => void;
  locked: boolean;
  isActualWinner: boolean;
  side: 'left' | 'right';
}) {
  const disabled = locked || !team;
  const bg = selected ? 'var(--tbl-ink)' : 'transparent';
  const fg = selected ? 'var(--tbl-bg)' : 'var(--tbl-ink)';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => team && onPick(team.slug)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '14px 14px',
        background: bg,
        color: fg,
        border: 'none',
        borderRight: side === 'left' ? '1px solid var(--tbl-ink)' : 'none',
        cursor: disabled ? 'default' : 'pointer',
        textAlign: 'left',
        width: '100%',
        minHeight: 58,
        fontFamily: 'var(--tbl-font-mono)',
        position: 'relative',
        opacity: locked && !selected && !isActualWinner ? 0.6 : 1,
      }}
    >
      {team ? (
        <>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              opacity: 0.7,
              minWidth: 16,
            }}
          >
            {team.seed}
          </span>
          {team.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.logo} alt="" style={{ width: 26, height: 26, objectFit: 'contain' }} />
          )}
          <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.1 }}>{team.name}</span>
          {selected && (
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 9,
                letterSpacing: '0.18em',
                fontWeight: 700,
                color: 'var(--tbl-accent-bright)',
              }}
            >
              PICK
            </span>
          )}
          {locked && isActualWinner && !selected && (
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 9,
                letterSpacing: '0.18em',
                fontWeight: 700,
                color: 'var(--tbl-green)',
              }}
            >
              WON
            </span>
          )}
        </>
      ) : (
        <span style={{ fontSize: 12, color: 'var(--tbl-ink-soft)', letterSpacing: '0.14em' }}>TBD</span>
      )}
    </button>
  );
}
