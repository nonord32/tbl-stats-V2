'use client';
// My Team — v2 redesign with ESPN-style roster table.
// Server passes enriched FantasyFighter rows (with opp / weekScore /
// seasonFpts / lastFpts) plus the week's starter slugs + lock time.
// Client handles starter swapping (subject to slot eligibility),
// POSTs /api/fantasy/lineup, and ticks the lock countdown.

import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  SLOT_LABELS,
  type FantasyFighter,
  type FantasySlot,
} from '@/lib/fantasyMock';

const SLOT_ORDER: FantasySlot[] = [
  'Female',
  'Light',
  'Welter',
  'Middle',
  'Heavy',
  'FLEX1',
  'FLEX2',
];

const FEMALE_CLASSES = new Set(['Super Lightweight', 'Bantamweight', 'Featherweight']);
function slotEligible(slot: FantasySlot, f: FantasyFighter): boolean {
  switch (slot) {
    case 'Female':
      return f.gender === 'Female' && FEMALE_CLASSES.has(f.weightClass);
    case 'Light':
      return f.gender === 'Male' && ['Featherweight', 'Lightweight'].includes(f.weightClass);
    case 'Welter':
      return f.gender === 'Male' && ['Welterweight', 'Super Welterweight'].includes(f.weightClass);
    case 'Middle':
      return f.gender === 'Male' && ['Middleweight', 'Super Middleweight'].includes(f.weightClass);
    case 'Heavy':
      return (
        f.gender === 'Male' &&
        ['Light Heavyweight', 'Cruiserweight', 'Heavyweight'].includes(f.weightClass)
      );
    case 'FLEX1':
    case 'FLEX2':
      return true;
  }
}

export interface RosterFighter extends FantasyFighter {
  opp: string | null;        // opponent TBL team this week ("BYE" if null)
  weekScore: number | null;  // actual fantasy points this week (null if no bout / unresolved)
  seasonFpts: number;        // sum of fantasy points across season
  lastFpts: number | null;   // most recent bout's fantasy points
}

interface TeamClientProps {
  roster: RosterFighter[];
  starterSlugs: string[];
  week: number;
  locksAtISO: string;
  resolved: boolean;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Locked';
  const totalMin = Math.floor(ms / 60_000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const minutes = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${minutes}m`;
}

function StatusPill({ status }: { status: FantasyFighter['status'] }) {
  const map: Record<FantasyFighter['status'], { label: string; cls: string }> = {
    active: { label: 'Active', cls: 'fv2-status-pill--active' },
    questionable: { label: 'Q', cls: 'fv2-status-pill--q' },
    out: { label: 'Out', cls: 'fv2-status-pill--out' },
    free: { label: 'FA', cls: '' },
  };
  const x = map[status];
  return <span className={`fv2-status-pill ${x.cls}`}>{x.label}</span>;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDelta(delta: number | null): { text: string; cls: string } {
  if (delta === null) return { text: '—', cls: '' };
  if (delta > 0) return { text: `+${delta.toFixed(1)}`, cls: 'fv2-delta--positive' };
  if (delta < 0) return { text: delta.toFixed(1), cls: 'fv2-delta--negative' };
  return { text: '0.0', cls: '' };
}

export function TeamClient({
  roster,
  starterSlugs: initialStarters,
  week,
  locksAtISO,
  resolved,
}: TeamClientProps) {
  const [starterSlugs, setStarterSlugs] = useState<string[]>(initialStarters);
  const [now, setNow] = useState(() => Date.now());
  const [savingSlot, setSavingSlot] = useState<FantasySlot | null>(null);
  const [openSlot, setOpenSlot] = useState<FantasySlot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const locksAt = new Date(locksAtISO).getTime();
  const msUntilLock = locksAt - now;
  const isLocked = msUntilLock <= 0 || resolved;

  const rosterById = useMemo(() => {
    const m = new Map<string, RosterFighter>();
    roster.forEach((f) => m.set(f.id, f));
    return m;
  }, [roster]);

  const lineup = SLOT_ORDER.map((slot, i) => ({
    slot,
    fighter: rosterById.get(starterSlugs[i] ?? '') ?? null,
  }));
  const startedIds = new Set(starterSlugs.filter(Boolean));
  const bench = roster.filter((f) => !startedIds.has(f.id));

  const totalProjected = lineup.reduce(
    (sum, row) => sum + (row.fighter?.projected ?? 0),
    0
  );
  const totalScore = lineup.reduce(
    (sum, row) => sum + (row.fighter?.weekScore ?? 0),
    0
  );
  const anyScored = lineup.some((row) => row.fighter?.weekScore !== null && row.fighter?.weekScore !== undefined);
  const totalFpts = lineup.reduce((sum, row) => sum + (row.fighter?.seasonFpts ?? 0), 0);
  const totalAvg = lineup.reduce((sum, row) => sum + (row.fighter?.avg ?? 0), 0);

  async function persistLineup(next: string[]) {
    const res = await fetch('/api/fantasy/lineup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ week, starter_slugs: next }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error ?? `Save failed (${res.status})`);
    }
  }

  async function handleSwap(slot: FantasySlot, newFighterId: string) {
    if (isLocked) return;
    setSavingSlot(slot);
    setError(null);
    const slotIdx = SLOT_ORDER.indexOf(slot);
    const next = starterSlugs.slice();
    while (next.length < SLOT_ORDER.length) next.push('');
    const existingIdx = next.indexOf(newFighterId);
    if (existingIdx >= 0 && existingIdx !== slotIdx) {
      next[existingIdx] = next[slotIdx];
    }
    next[slotIdx] = newFighterId;
    try {
      await persistLineup(next);
      setStarterSlugs(next);
      setOpenSlot(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingSlot(null);
    }
  }

  return (
    <div className="fv2-body">
      {/* Hero */}
      <section className="fv2-hero">
        <div className="fv2-hero__eyebrow">My Team · Week {week}</div>
        <div className="fv2-hero__title">Throwing Hands FC</div>
        <div className="fv2-hero__sub">
          {isLocked ? (
            resolved ? (
              <>Week {week} resolved — see <strong>Scoring</strong></>
            ) : (
              <>Lineup locked at <strong>{new Date(locksAt).toLocaleString()}</strong></>
            )
          ) : (
            <>Lineup locks in <strong>{formatCountdown(msUntilLock)}</strong></>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
          <span
            className={`fv2-lock-pill ${
              isLocked ? 'fv2-lock-pill--locked' : 'fv2-lock-pill--open'
            }`}
          >
            {isLocked ? '🔒 Locked' : `Locks in ${formatCountdown(msUntilLock)}`}
          </span>
        </div>
      </section>

      {/* Stat strip */}
      <section className="fv2-section">
        <div className="fv2-stat-grid">
          <div className="fv2-stat">
            <div className="fv2-stat__label">Projected</div>
            <div className="fv2-stat__value">{totalProjected.toFixed(1)}</div>
            <div className="fv2-stat__hint">7 starters</div>
          </div>
          <div className="fv2-stat">
            <div className="fv2-stat__label">Score so far</div>
            <div className="fv2-stat__value fv2-stat__value--accent">
              {anyScored ? totalScore.toFixed(1) : '—'}
            </div>
            <div className="fv2-stat__hint">
              {anyScored ? 'live this week' : 'no resolved bouts'}
            </div>
          </div>
          <div className="fv2-stat">
            <div className="fv2-stat__label">Bench</div>
            <div className="fv2-stat__value">{bench.length}</div>
            <div className="fv2-stat__hint">reserves</div>
          </div>
          <div className="fv2-stat">
            <div className="fv2-stat__label">Roster size</div>
            <div className="fv2-stat__value">{roster.length}</div>
            <div className="fv2-stat__hint">total drafted</div>
          </div>
        </div>
      </section>

      {error && <div className="fv2-error">{error}</div>}

      {/* Starters table */}
      <section className="fv2-section">
        <div className="fv2-section-head">
          <span className="fv2-section-head__title">Starters · 7 slots</span>
          <span className="fv2-section-head__meta">
            {isLocked ? 'Locked' : 'Tap Swap to change a starter'}
          </span>
        </div>

        <div className="fv2-roster-wrap">
          <table className="fv2-roster">
            <thead>
              <tr className="fv2-roster__group-row">
                <th colSpan={3} className="fv2-col-left">Starters</th>
                <th colSpan={5}>Week {week}</th>
                <th colSpan={3}>Season</th>
              </tr>
              <tr className="fv2-roster__col-row">
                <th className="fv2-col-left">Slot</th>
                <th className="fv2-col-left">Player</th>
                <th>Action</th>
                <th>Opp</th>
                <th>Status</th>
                <th>Proj</th>
                <th>Score</th>
                <th>+/-</th>
                <th>Fpts</th>
                <th>Avg</th>
                <th>Last</th>
              </tr>
            </thead>
            <tbody>
              {lineup.map((row) => {
                const slot = row.slot;
                const f = row.fighter;
                const eligibleBench = bench.filter((b) => slotEligible(slot, b));
                const isOpen = openSlot === slot;
                const isSaving = savingSlot === slot;
                const delta =
                  f && f.weekScore !== null
                    ? Number((f.weekScore - f.projected).toFixed(1))
                    : null;
                const deltaFmt = formatDelta(delta);

                return (
                  <Fragment key={slot}>
                    <tr className={f ? '' : 'is-empty'}>
                      <td className="fv2-col-left fv2-roster__slot">
                        {SLOT_LABELS[slot]}
                      </td>
                      <td className="fv2-col-left">
                        <div className="fv2-roster__player">
                          <div
                            className={`fv2-roster__avatar${
                              f ? '' : ' fv2-roster__avatar--empty'
                            }`}
                          >
                            {f ? initials(f.name) : '—'}
                          </div>
                          <div className="fv2-roster__player-info">
                            <div className="fv2-roster__player-name">
                              {f ? f.name : 'Empty'}
                            </div>
                            <div className="fv2-roster__player-meta">
                              {f
                                ? `${f.team} · ${f.weightClass}`
                                : '— pick a fighter —'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`fv2-action-btn${
                            isOpen ? ' fv2-action-btn--active' : ''
                          }`}
                          disabled={
                            isLocked || isSaving || eligibleBench.length === 0
                          }
                          onClick={() => setOpenSlot(isOpen ? null : slot)}
                        >
                          {isSaving ? 'Saving' : isOpen ? 'Close' : 'Swap'}
                        </button>
                      </td>
                      <td>{f?.opp ?? 'BYE'}</td>
                      <td>{f ? <StatusPill status={f.status} /> : '—'}</td>
                      <td>{f ? f.projected.toFixed(1) : '—'}</td>
                      <td>
                        {f && f.weekScore !== null ? f.weekScore.toFixed(1) : '—'}
                      </td>
                      <td className={deltaFmt.cls}>{deltaFmt.text}</td>
                      <td>{f ? f.seasonFpts.toFixed(1) : '—'}</td>
                      <td>{f ? f.avg.toFixed(1) : '—'}</td>
                      <td>
                        {f && f.lastFpts !== null ? f.lastFpts.toFixed(1) : '—'}
                      </td>
                    </tr>
                    {isOpen && f && (
                      <tr>
                        <td colSpan={11} style={{ padding: 0 }}>
                          <div className="fv2-swap-tray">
                            <div className="fv2-swap-tray__head">
                              Eligible bench fighters
                            </div>
                            {eligibleBench.length === 0 ? (
                              <div className="fv2-empty" style={{ padding: 14 }}>
                                No bench fighters fit this slot. Draft someone or
                                claim a free agent.
                              </div>
                            ) : (
                              <div className="fv2-swap-grid">
                                {eligibleBench
                                  .slice()
                                  .sort((a, b) => b.projected - a.projected)
                                  .map((b) => (
                                    <button
                                      key={b.id}
                                      type="button"
                                      className="fv2-swap-card"
                                      onClick={() => handleSwap(slot, b.id)}
                                      disabled={isSaving}
                                    >
                                      <div className="fv2-swap-card__name">
                                        {b.name}
                                      </div>
                                      <div className="fv2-swap-card__meta">
                                        {b.team} · {b.weightClass}
                                      </div>
                                      <div className="fv2-swap-card__proj">
                                        Proj {b.projected.toFixed(1)}
                                      </div>
                                    </button>
                                  ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              <tr className="fv2-roster__totals">
                <td colSpan={2} className="fv2-col-left">Totals</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td>{totalProjected.toFixed(1)}</td>
                <td>{anyScored ? totalScore.toFixed(1) : '—'}</td>
                <td>—</td>
                <td>{totalFpts.toFixed(1)}</td>
                <td>{totalAvg.toFixed(1)}</td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Bench table */}
      <section className="fv2-section">
        <div className="fv2-section-head">
          <span className="fv2-section-head__title">
            Bench · {bench.length} reserves
          </span>
          <span className="fv2-section-head__meta">Use Swap above to start them</span>
        </div>

        {bench.length === 0 ? (
          <div className="fv2-empty">
            Every fighter on your roster is starting this week.
          </div>
        ) : (
          <div className="fv2-roster-wrap">
            <table className="fv2-roster">
              <thead>
                <tr className="fv2-roster__col-row">
                  <th className="fv2-col-left">Player</th>
                  <th>Opp</th>
                  <th>Status</th>
                  <th>Proj</th>
                  <th>Score</th>
                  <th>Fpts</th>
                  <th>Avg</th>
                  <th>Last</th>
                </tr>
              </thead>
              <tbody>
                {bench
                  .slice()
                  .sort((a, b) => b.projected - a.projected)
                  .map((b) => (
                    <tr key={b.id}>
                      <td className="fv2-col-left">
                        <div className="fv2-roster__player">
                          <div className="fv2-roster__avatar">{initials(b.name)}</div>
                          <div className="fv2-roster__player-info">
                            <div className="fv2-roster__player-name">{b.name}</div>
                            <div className="fv2-roster__player-meta">
                              {b.team} · {b.weightClass}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>{b.opp ?? 'BYE'}</td>
                      <td>
                        <StatusPill status={b.status} />
                      </td>
                      <td>{b.projected.toFixed(1)}</td>
                      <td>{b.weekScore !== null ? b.weekScore.toFixed(1) : '—'}</td>
                      <td>{b.seasonFpts.toFixed(1)}</td>
                      <td>{b.avg.toFixed(1)}</td>
                      <td>{b.lastFpts !== null ? b.lastFpts.toFixed(1) : '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
