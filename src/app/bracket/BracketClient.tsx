'use client';
// src/app/bracket/BracketClient.tsx
// Gazette-styled Bracket Challenge — a real left-to-right bracket (reusing the
// .po-* bracket scaffold from the Playoffs tab). Signed-in users fill out the
// WHOLE bracket up front: pick all four quarterfinal winners, then the two
// semifinal winners from their own QF picks, then the champion, plus a
// combined-final-score tiebreaker. Everything locks together 1.5h after the
// first playoff game starts — there is no coming back to pick a semifinal once
// the quarterfinals are decided. Auto-saves on change; after lock it becomes a
// read-only scorecard grading each pick against the live results.

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

  const bySlug = useMemo(() => {
    const m = new Map<string, Seed>();
    seeds.forEach((s) => m.set(s.team.slug, s));
    return m;
  }, [seeds]);

  // ── Prediction state ──────────────────────────────────────────────────────
  const [qf, setQf] = useState<string[]>(() =>
    [0, 1, 2, 3].map((i) => entry?.qf_winners?.[i] ?? '')
  );
  const [sf, setSf] = useState<string[]>(() =>
    [0, 1].map((i) => entry?.sf_winners?.[i] ?? '')
  );
  const [champ, setChamp] = useState<string>(entry?.champion ?? '');
  const [finalTotal, setFinalTotal] = useState<string>(
    entry?.final_total != null ? String(entry.final_total) : ''
  );

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<boolean>(!!entry);
  const [error, setError] = useState('');

  // Persistence uses a "latest-wins" queue instead of a debounce: every click
  // fires the save immediately (the highlight already updated optimistically),
  // and if you click again while a request is in flight the newest state is
  // queued and sent the moment the previous one returns. No waiting, no races,
  // and out-of-order responses can't clobber a newer pick.
  const lastSaved = useRef<string>(
    JSON.stringify({
      qf: entry?.qf_winners ?? [],
      sf: entry?.sf_winners ?? [],
      champ: entry?.champion ?? null,
      total: entry?.final_total ?? null,
    })
  );
  const pending = useRef<{ payload: object; sig: string } | null>(null);
  const inFlight = useRef(false);

  async function flush() {
    if (inFlight.current) return;
    const job = pending.current;
    if (!job) return;
    pending.current = null;
    inFlight.current = true;
    setSaving(true);
    setError('');
    let ok = false;
    try {
      const res = await fetch('/api/bracket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(job.payload),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        lastSaved.current = job.sig;
        ok = true;
      } else {
        setError(json.error ?? 'Failed to save your bracket');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      inFlight.current = false;
      if (pending.current) {
        // A newer pick landed while saving — send it right away.
        flush();
      } else {
        setSaving(false);
        if (ok) setSaved(true);
      }
    }
  }

  function persist(nextQf: string[], nextSf: string[], nextChamp: string, nextTotal: string) {
    if (!open) return;
    const totalNum = nextTotal.trim() === '' ? null : Number(nextTotal);
    const payload = {
      qf_winners: nextQf,
      sf_winners: nextSf,
      champion: nextChamp || null,
      final_total: totalNum != null && Number.isFinite(totalNum) ? Math.round(totalNum) : null,
    };
    const sig = JSON.stringify(payload);
    if (sig === lastSaved.current) return;
    pending.current = { payload, sig };
    setSaved(false);
    flush();
  }

  // Clear downstream picks a change just invalidated so the bracket stays a
  // valid chain (SF winner ∈ its QF winners; champion ∈ SF winners).
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
    persist(nextQf, sf2, champ2, finalTotal);
  }

  function pickSf(slot: number, slug: string) {
    if (!open) return;
    const nextSf = [...sf];
    nextSf[slot] = nextSf[slot] === slug ? '' : slug;
    const { sf2, champ2 } = sanitize(qf, nextSf, champ);
    setSf(sf2);
    setChamp(champ2);
    persist(qf, sf2, champ2, finalTotal);
  }

  function pickChamp(slug: string) {
    if (!open) return;
    const next = champ === slug ? '' : slug;
    setChamp(next);
    persist(qf, sf, next, finalTotal);
  }

  function onFinalTotal(v: string) {
    if (!open) return;
    const clean = v.replace(/[^0-9]/g, '').slice(0, 3);
    setFinalTotal(clean);
    persist(qf, sf, champ, clean);
  }

  // ── Participants per round (from the user's own picks) ─────────────────────
  const qfA = bracket.qf.map((m) => seedTeam(m.a));
  const qfB = bracket.qf.map((m) => seedTeam(m.b));
  const sfPart: Array<[SlotTeam | null, SlotTeam | null]> = [
    [slugTeam(qf[0], bySlug), slugTeam(qf[1], bySlug)],
    [slugTeam(qf[2], bySlug), slugTeam(qf[3], bySlug)],
  ];
  const finalPart: [SlotTeam | null, SlotTeam | null] = [
    slugTeam(sf[0], bySlug),
    slugTeam(sf[1], bySlug),
  ];
  const championTeam = slugTeam(champ, bySlug);

  // ── Scoring (locked view) ──────────────────────────────────────────────────
  const scoreEntry: BracketEntry = {
    user_id: entry?.user_id ?? '',
    qf_winners: qf,
    sf_winners: sf,
    champion: champ || null,
    final_total: finalTotal.trim() === '' ? null : Number(finalTotal),
    created_at: entry?.created_at ?? '',
    updated_at: entry?.updated_at ?? '',
  };
  const score = scoreBracketEntry(scoreEntry, bracket);
  const finalTotalActual = actualFinalTotal(bracket);

  const madeCount = qf.filter(Boolean).length + sf.filter(Boolean).length + (champ ? 1 : 0);
  const complete = madeCount === 7 && finalTotal.trim() !== '';
  const lockMs = lockISO ? new Date(lockISO).getTime() - now : null;
  const countdown = lockMs != null ? formatCountdown(lockMs) : null;
  const statusText = saving ? 'Saving…' : error ? error : saved ? 'Saved' : '';

  const actualQfWinner = (i: number) =>
    bracket.qf[i].status === 'played' ? bracket.qf[i].winnerSlug : undefined;
  const actualSfWinner = (i: number) =>
    bracket.sf[i].status === 'played' ? bracket.sf[i].winnerSlug : undefined;
  const actualChampion = bracket.final.status === 'played' ? bracket.championSlug : undefined;

  // A single matchup, rendered identically in the desktop bracket and the
  // mobile stack (React keys keep the two DOM copies independent).
  const qfMatch = (i: number, where: string) => (
    <PickMatch
      key={`${where}-qf-${i}`}
      teamA={qfA[i]} teamB={qfB[i]} selected={qf[i]} onPick={(s) => pickQf(i, s)}
      locked={!open} actualWinner={actualQfWinner(i)} pts={QF_POINTS}
    />
  );
  const sfMatch = (i: number, where: string) => (
    <PickMatch
      key={`${where}-sf-${i}`}
      teamA={sfPart[i][0]} teamB={sfPart[i][1]} selected={sf[i]} onPick={(s) => pickSf(i, s)}
      locked={!open} actualWinner={actualSfWinner(i)} pts={SF_POINTS}
    />
  );
  const finalMatch = (where: string) => (
    <PickMatch
      key={`${where}-final`}
      teamA={finalPart[0]} teamB={finalPart[1]} selected={champ} onPick={pickChamp}
      locked={!open} actualWinner={actualChampion} pts={CHAMP_POINTS} final
    />
  );

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
          <div className="tbl-display" style={{ fontSize: 56, lineHeight: 0.95, marginTop: 8 }}>
            Bracket Challenge
          </div>
          <div
            style={{
              fontFamily: 'var(--tbl-font-mono)',
              fontSize: 11,
              letterSpacing: '0.2em',
              color: 'var(--tbl-ink-soft)',
              textTransform: 'uppercase',
              fontWeight: 700,
              marginTop: 10,
            }}
          >
            Fill the whole bracket · 1 pt QF · 2 pt SF · 4 pt Final · Tiebreaker: final score
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
              {open ? `${madeCount}/7` : `${score.points}/${MAX_BRACKET_POINTS}`}
            </div>
          </div>
          <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(244,237,224,0.25)' }} />
          <div>
            <div style={chipLabelStyle}>{open ? 'Locks in' : 'Status'}</div>
            <div
              className="tbl-display"
              style={{ fontSize: 28, lineHeight: 1, marginTop: 2, color: 'var(--tbl-accent-bright)' }}
            >
              {open ? countdown ?? 'Open' : 'Locked'}
            </div>
          </div>
        </div>
      </div>

      <div className="tbl-page-body" style={{ paddingTop: 22 }}>
        {/* Status / completeness line */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
            fontFamily: 'var(--tbl-font-mono)',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontWeight: 700,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color: error ? 'var(--tbl-red)' : 'var(--tbl-ink-soft)' }}>
            {open
              ? complete
                ? 'Bracket complete — you can still edit until it locks'
                : 'Pick every matchup, a champion, and the tiebreaker before it locks'
              : 'Entries are locked — grading live results'}
          </span>
          <span
            style={{
              color: open && complete ? 'var(--tbl-green)' : 'var(--tbl-ink-soft)',
            }}
          >
            {statusText || (open && complete ? '✓ Complete' : '')}
          </span>
        </div>

        {/* ── Desktop: full left-to-right bracket ────────────────────────── */}
        <div className="bc-desktop-only po-bracket-scroll">
          <div className="po-bracket">
            {/* Quarterfinals — top half */}
            <div className="po-col po-col--qf">
              <div className="po-round-rule">Quarterfinals</div>
              {qfMatch(0, 'd')}
              {qfMatch(1, 'd')}
            </div>

            {/* Semifinal — top */}
            <div className="po-col po-col--sf">
              <div className="po-round-rule">Semifinal</div>
              {sfMatch(0, 'd')}
            </div>

            {/* Final */}
            <div className="po-col po-col--f">
              <div className="po-round-rule">Final</div>
              {finalMatch('d')}
            </div>

            {/* Semifinal — bottom */}
            <div className="po-col po-col--sf po-col--sf-bottom">
              <div className="po-round-rule">Semifinal</div>
              {sfMatch(1, 'd')}
            </div>

            {/* Quarterfinals — bottom half */}
            <div className="po-col po-col--qf po-col--qf-bottom">
              <div className="po-round-rule">Quarterfinals</div>
              {qfMatch(2, 'd')}
              {qfMatch(3, 'd')}
            </div>
          </div>
        </div>

        {/* ── Mobile: stacked round-by-round picker ──────────────────────── */}
        <div className="bc-mobile-only">
          <MobileRound label="Quarterfinals" note="1 pt each">
            {qfMatch(0, 'm')}
            {qfMatch(1, 'm')}
            {qfMatch(2, 'm')}
            {qfMatch(3, 'm')}
          </MobileRound>
          <MobileRound label="Semifinals" note="2 pts each">
            {sfMatch(0, 'm')}
            {sfMatch(1, 'm')}
          </MobileRound>
          <MobileRound label="Final · MegaBrawl IV" note="4 pts">
            {finalMatch('m')}
          </MobileRound>
        </div>

        {/* ── Champion + tiebreaker ──────────────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 14,
            marginTop: 8,
          }}
        >
          {/* Predicted champion */}
          <div
            style={{
              border: '1.5px solid var(--tbl-ink)',
              background: championTeam ? 'var(--tbl-ink)' : 'var(--tbl-paper)',
              color: championTeam ? 'var(--tbl-bg)' : 'var(--tbl-ink)',
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              minHeight: 78,
            }}
          >
            <div style={{ ...chipLabelStyle, color: championTeam ? 'rgba(244,237,224,0.6)' : 'var(--tbl-ink-soft)' }}>
              Your<br />Champion
            </div>
            {championTeam ? (
              <>
                {championTeam.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={championTeam.logo} alt="" style={{ width: 34, height: 34, objectFit: 'contain' }} />
                )}
                <div className="tbl-display" style={{ fontSize: 24, lineHeight: 1 }}>
                  {championTeam.name}
                </div>
              </>
            ) : (
              <div style={{ fontFamily: 'var(--tbl-font-mono)', fontSize: 12, color: 'var(--tbl-ink-soft)' }}>
                Pick your way to a champion
              </div>
            )}
            {!open && actualChampion && (
              <div style={{ marginLeft: 'auto', fontFamily: 'var(--tbl-font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em' }}>
                {champ && champ === actualChampion ? (
                  <span style={{ color: 'var(--tbl-green)' }}>✓ +{CHAMP_POINTS}</span>
                ) : (
                  <span style={{ color: 'var(--tbl-accent-bright)' }}>
                    {getFullTeamName(actualChampion)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Tiebreaker */}
          <div
            style={{
              border: '1.5px solid var(--tbl-ink)',
              background: 'var(--tbl-paper)',
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
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
                }}
              >
                Tiebreaker
              </div>
              <div style={{ fontFamily: 'var(--tbl-font-mono)', fontSize: 11, color: 'var(--tbl-ink-soft)', marginTop: 4 }}>
                Combined final score (both teams)
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
                  width: 88,
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
                <div className="tbl-display" style={{ fontSize: 26 }}>{finalTotal || '—'}</div>
                {finalTotalActual != null && (
                  <div style={{ fontSize: 11, color: 'var(--tbl-ink-soft)', marginTop: 2 }}>
                    Actual {finalTotalActual}
                  </div>
                )}
              </div>
            )}
          </div>
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
  lineHeight: 1.2,
};

// Mobile stacked round: a labeled section with its matchups in a column.
function MobileRound({
  label,
  note,
  children,
}: {
  label: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div className="tbl-section-rule">
        <span>{label}</span>
        <span>{note}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

// A single bracket cell with two clickable team lines.
function PickMatch({
  teamA,
  teamB,
  selected,
  onPick,
  locked,
  actualWinner,
  pts,
  final,
}: {
  teamA: SlotTeam | null;
  teamB: SlotTeam | null;
  selected: string;
  onPick: (slug: string) => void;
  locked: boolean;
  actualWinner?: string;
  pts: number;
  final?: boolean;
}) {
  const earned = locked && !!actualWinner && !!selected && selected === actualWinner;
  const missed = locked && !!actualWinner && !!selected && selected !== actualWinner;

  return (
    <div className={`po-match${final ? ' bc-match--final' : ''}`} style={{ background: 'var(--tbl-paper)' }}>
      <SeedPick
        team={teamA}
        selected={!!selected && teamA?.slug === selected}
        onPick={onPick}
        locked={locked}
        actualWinner={actualWinner}
      />
      <div className="po-match__rule">vs</div>
      <SeedPick
        team={teamB}
        selected={!!selected && teamB?.slug === selected}
        onPick={onPick}
        locked={locked}
        actualWinner={actualWinner}
      />
      {locked && actualWinner && (
        <div
          style={{
            borderTop: '1px solid var(--tbl-ink)',
            padding: '4px 10px',
            fontFamily: 'var(--tbl-font-mono)',
            fontSize: 9,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            fontWeight: 700,
            textAlign: 'right',
            color: earned ? 'var(--tbl-green)' : missed ? 'var(--tbl-red)' : 'var(--tbl-ink-soft)',
          }}
        >
          {earned ? `+${pts} pts` : missed ? '0 pts' : `${pts} pts`}
        </div>
      )}
    </div>
  );
}

function SeedPick({
  team,
  selected,
  onPick,
  locked,
  actualWinner,
}: {
  team: SlotTeam | null;
  selected: boolean;
  onPick: (slug: string) => void;
  locked: boolean;
  actualWinner?: string;
}) {
  if (!team) {
    return <div className="po-tbd">TBD</div>;
  }
  const isActualWinner = !!actualWinner && team.slug === actualWinner;
  const dim = locked && !selected && !isActualWinner;
  const disabled = locked;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(team.slug)}
      style={{
        display: 'grid',
        gridTemplateColumns: '22px 26px 1fr auto',
        alignItems: 'center',
        gap: 8,
        padding: '9px 10px',
        width: '100%',
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        textAlign: 'left',
        fontFamily: 'var(--tbl-font-serif)',
        background: selected ? 'color-mix(in srgb, var(--tbl-accent) 14%, transparent)' : 'transparent',
        boxShadow: selected ? 'inset 3px 0 0 var(--tbl-accent)' : 'none',
        opacity: dim ? 0.5 : 1,
      }}
    >
      <span
        style={{
          fontWeight: 900,
          fontSize: 18,
          color: 'var(--tbl-accent)',
          lineHeight: 1,
        }}
      >
        {team.seed}
      </span>
      {team.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logo} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />
      ) : (
        <span />
      )}
      <span
        style={{
          fontWeight: 800,
          fontSize: 13,
          color: 'var(--tbl-ink)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {team.name}
      </span>
      {selected ? (
        <span
          style={{
            fontFamily: 'var(--tbl-font-mono)',
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: '0.16em',
            color: 'var(--tbl-accent)',
          }}
        >
          PICK
        </span>
      ) : locked && isActualWinner ? (
        <span
          style={{
            fontFamily: 'var(--tbl-font-mono)',
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: '0.16em',
            color: 'var(--tbl-green)',
          }}
        >
          WON
        </span>
      ) : (
        <span />
      )}
    </button>
  );
}
