'use client';
// My Team — v2 redesign with ESPN-style roster table.
// Server passes enriched FantasyFighter rows (with opp / matchStartUTC /
// weekScore / seasonFpts / lastFpts) plus the week's starter slugs.
// Client handles starter swapping with PER-FIGHTER locking — each
// starter locks individually when their match kicks off, not the whole
// lineup at once. Team name is user-editable inline.

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
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
  opp: string | null;             // opponent TBL team this week ("BYE" if null)
  matchStartUTC: string | null;   // ISO; null = no match this week
  weekScore: number | null;
  seasonFpts: number;
  lastFpts: number | null;
}

interface TeamClientProps {
  roster: RosterFighter[];
  starterSlugs: string[];
  week: number;
  teamName: string | null;
  resolved: boolean;
}

const DEFAULT_TEAM_NAME = 'My Team';
const MAX_TEAM_NAME = 32;

function isLocked(f: RosterFighter | null, now: number): boolean {
  if (!f) return false;
  if (!f.matchStartUTC) return false;
  return new Date(f.matchStartUTC).getTime() <= now;
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

function formatNextLock(ts: number, now: number): string {
  const diff = ts - now;
  if (diff <= 0) return 'now';
  const totalMin = Math.floor(diff / 60_000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const minutes = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${minutes}m`;
}

export function TeamClient({
  roster,
  starterSlugs: initialStarters,
  week,
  teamName: initialTeamName,
  resolved,
}: TeamClientProps) {
  const [starterSlugs, setStarterSlugs] = useState<string[]>(initialStarters);
  const [now, setNow] = useState(() => Date.now());
  const [savingSlot, setSavingSlot] = useState<FantasySlot | null>(null);
  const [openSlot, setOpenSlot] = useState<FantasySlot | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Team name state (inline edit)
  const [teamName, setTeamName] = useState<string>(initialTeamName ?? DEFAULT_TEAM_NAME);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(teamName);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaving, setNameSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  // Tick clock every 30s for lock countdowns. We re-render so the lock
  // state of each slot can flip in real time as kickoffs pass.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (editingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [editingName]);

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

  // Per-slot lock = the starter currently in that slot has kicked off.
  const slotLocked = lineup.map((row) => isLocked(row.fighter, now));
  const lockedCount = slotLocked.filter(Boolean).length;
  const allLocked = lockedCount === 7 || resolved;

  // Next future kickoff among the unlocked starters (for "Next lock in …").
  const nextLockMs = lineup
    .filter((r) => r.fighter?.matchStartUTC)
    .map((r) => new Date(r.fighter!.matchStartUTC!).getTime())
    .filter((ts) => ts > now)
    .sort((a, b) => a - b)[0];

  const totalScore = lineup.reduce(
    (sum, row) => sum + (row.fighter?.weekScore ?? 0),
    0
  );
  const anyScored = lineup.some(
    (row) =>
      row.fighter?.weekScore !== null && row.fighter?.weekScore !== undefined
  );
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

  function startEditName() {
    setNameInput(teamName);
    setNameError(null);
    setEditingName(true);
  }
  function cancelEditName() {
    setEditingName(false);
    setNameInput(teamName);
    setNameError(null);
  }
  async function commitTeamName() {
    const trimmed = nameInput.trim().replace(/\s+/g, ' ');
    if (trimmed.length === 0) {
      setNameError('Name required');
      return;
    }
    if (trimmed.length > MAX_TEAM_NAME) {
      setNameError(`Max ${MAX_TEAM_NAME} chars`);
      return;
    }
    if (trimmed === teamName) {
      setEditingName(false);
      return;
    }
    setNameSaving(true);
    setNameError(null);
    try {
      const res = await fetch('/api/fantasy/team-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_name: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNameError(json.error ?? 'Save failed');
        return;
      }
      setTeamName(trimmed);
      setEditingName(false);
    } catch {
      setNameError('Network error');
    } finally {
      setNameSaving(false);
    }
  }

  return (
    <div className="fv2-body">
      {/* Hero */}
      <section className="fv2-hero">
        <div className="fv2-hero__eyebrow">My Team · Week {week}</div>

        {/* Editable team name */}
        {editingName ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              ref={nameInputRef}
              className="fv2-input"
              style={{ fontSize: 24, fontWeight: 700, padding: '8px 12px', minWidth: 280 }}
              value={nameInput}
              maxLength={MAX_TEAM_NAME}
              disabled={nameSaving}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTeamName();
                if (e.key === 'Escape') cancelEditName();
              }}
              onBlur={() => {
                // Defer so click on Save button registers first.
                setTimeout(() => {
                  if (editingName) commitTeamName();
                }, 100);
              }}
              aria-label="Team name"
            />
            <button
              type="button"
              className="fv2-btn fv2-btn--primary fv2-btn--sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={commitTeamName}
              disabled={nameSaving}
            >
              {nameSaving ? 'Saving' : 'Save'}
            </button>
            <button
              type="button"
              className="fv2-btn fv2-btn--ghost fv2-btn--sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={cancelEditName}
              disabled={nameSaving}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEditName}
            title="Click to rename"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              margin: 0,
              color: 'inherit',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
            className="fv2-hero__title"
          >
            {teamName}
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: 0.4 }}
              aria-hidden
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
        {nameError && (
          <div style={{ fontSize: 11, color: 'var(--fv2-negative)', marginTop: 6 }}>
            {nameError}
          </div>
        )}

        <div className="fv2-hero__sub">
          {resolved ? (
            <>
              Week {week} resolved — see <strong>Scoring</strong>
            </>
          ) : allLocked ? (
            <>
              All <strong>7 of 7</strong> starters locked
            </>
          ) : lockedCount > 0 ? (
            <>
              <strong>
                {lockedCount} of 7
              </strong>{' '}
              starters locked
              {nextLockMs && (
                <>
                  {' '}
                  · next lock in <strong>{formatNextLock(nextLockMs, now)}</strong>
                </>
              )}
            </>
          ) : nextLockMs ? (
            <>
              First kickoff in <strong>{formatNextLock(nextLockMs, now)}</strong>
            </>
          ) : (
            <>No matches this week</>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
          <span
            className={`fv2-lock-pill ${
              allLocked
                ? 'fv2-lock-pill--locked'
                : lockedCount > 0
                ? ''
                : 'fv2-lock-pill--open'
            }`}
          >
            {allLocked
              ? '🔒 Fully locked'
              : `${lockedCount}/7 locked`}
          </span>
        </div>
      </section>

      {/* Stat strip */}
      <section className="fv2-section">
        <div
          className="fv2-stat-grid"
          style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
        >
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
            {allLocked
              ? 'All locked'
              : 'Tap Swap to change an unlocked starter'}
          </span>
        </div>

        <div className="fv2-roster-wrap">
          <table className="fv2-roster">
            <thead>
              <tr className="fv2-roster__group-row">
                <th colSpan={3} className="fv2-col-left">Starters</th>
                <th colSpan={3}>Week {week}</th>
                <th colSpan={3}>Season</th>
              </tr>
              <tr className="fv2-roster__col-row">
                <th className="fv2-col-left">Slot</th>
                <th className="fv2-col-left">Player</th>
                <th>Action</th>
                <th>Opp</th>
                <th>Status</th>
                <th>Score</th>
                <th>Fpts</th>
                <th>Avg</th>
                <th>Last</th>
              </tr>
            </thead>
            <tbody>
              {lineup.map((row, idx) => {
                const slot = row.slot;
                const f = row.fighter;
                const isOpen = openSlot === slot;
                const isSaving = savingSlot === slot;
                const locked = slotLocked[idx];
                // Eligible bench fighters whose own match also hasn't kicked off.
                const eligibleBench = bench.filter((b) => slotEligible(slot, b));
                const swappableBench = eligibleBench.filter((b) => !isLocked(b, now));
                const canSwap = !resolved && !locked && swappableBench.length > 0;

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
                            <div
                              className="fv2-roster__player-name"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            >
                              {f ? f.name : 'Empty'}
                              {locked && (
                                <span title="Match has started" aria-label="Locked" style={{ fontSize: 11 }}>🔒</span>
                              )}
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
                          disabled={!canSwap || isSaving}
                          onClick={() => setOpenSlot(isOpen ? null : slot)}
                          title={
                            resolved
                              ? 'Week resolved'
                              : locked
                              ? `${f?.name ?? 'Slot'} has kicked off`
                              : swappableBench.length === 0
                              ? 'No eligible bench fighters'
                              : undefined
                          }
                        >
                          {isSaving
                            ? 'Saving'
                            : locked
                            ? 'Locked'
                            : isOpen
                            ? 'Close'
                            : 'Swap'}
                        </button>
                      </td>
                      <td>{f?.opp ?? 'BYE'}</td>
                      <td>{f ? <StatusPill status={f.status} /> : '—'}</td>
                      <td>
                        {f && f.weekScore !== null ? f.weekScore.toFixed(1) : '—'}
                      </td>
                      <td>{f ? f.seasonFpts.toFixed(1) : '—'}</td>
                      <td>{f ? f.avg.toFixed(1) : '—'}</td>
                      <td>
                        {f && f.lastFpts !== null ? f.lastFpts.toFixed(1) : '—'}
                      </td>
                    </tr>
                    {isOpen && f && (
                      <tr>
                        <td colSpan={9} style={{ padding: 0 }}>
                          <div className="fv2-swap-tray">
                            <div className="fv2-swap-tray__head">
                              Eligible bench fighters
                              {eligibleBench.length !== swappableBench.length && (
                                <span style={{ marginLeft: 8, color: 'var(--fv2-text-3)', fontWeight: 400 }}>
                                  · {eligibleBench.length - swappableBench.length} locked (already kicked off)
                                </span>
                              )}
                            </div>
                            {swappableBench.length === 0 ? (
                              <div className="fv2-empty" style={{ padding: 14 }}>
                                No swappable bench fighters fit this slot.
                              </div>
                            ) : (
                              <div className="fv2-swap-grid">
                                {swappableBench
                                  .slice()
                                  .sort((a, b) => b.avg - a.avg)
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
                                        Avg {b.avg.toFixed(1)}
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
                <td>{anyScored ? totalScore.toFixed(1) : '—'}</td>
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
                  <th>Score</th>
                  <th>Fpts</th>
                  <th>Avg</th>
                  <th>Last</th>
                </tr>
              </thead>
              <tbody>
                {bench
                  .slice()
                  .sort((a, b) => b.avg - a.avg)
                  .map((b) => {
                    const benchLocked = isLocked(b, now);
                    return (
                      <tr key={b.id}>
                        <td className="fv2-col-left">
                          <div className="fv2-roster__player">
                            <div className="fv2-roster__avatar">{initials(b.name)}</div>
                            <div className="fv2-roster__player-info">
                              <div
                                className="fv2-roster__player-name"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                              >
                                {b.name}
                                {benchLocked && (
                                  <span title="Match has started" aria-label="Locked" style={{ fontSize: 11 }}>🔒</span>
                                )}
                              </div>
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
                        <td>
                          {b.weekScore !== null ? b.weekScore.toFixed(1) : '—'}
                        </td>
                        <td>{b.seasonFpts.toFixed(1)}</td>
                        <td>{b.avg.toFixed(1)}</td>
                        <td>
                          {b.lastFpts !== null ? b.lastFpts.toFixed(1) : '—'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
