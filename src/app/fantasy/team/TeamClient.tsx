'use client';
// Client-side roster + lineup editor. Server hands us the persisted
// roster (the user's full draft) + this week's starter slugs + the
// locks_at timestamp. We render starters/bench, let the user swap a
// starter with a bench fighter (subject to slot eligibility), POST
// /api/fantasy/lineup on each change, and tick a countdown to lock.

import { useEffect, useMemo, useState } from 'react';
import {
  SLOT_LABELS,
  SLOT_RULES,
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

interface TeamClientProps {
  roster: FantasyFighter[];     // every fighter the user owns
  starterSlugs: string[];       // length 7 in SLOT_ORDER
  week: number;
  locksAtISO: string;
  resolved: boolean;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'LOCKED';
  const totalMin = Math.floor(ms / 60_000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const minutes = totalMin % 60;
  if (days > 0) return `${days}D ${hours}H`;
  if (hours > 0) return `${hours}H ${String(minutes).padStart(2, '0')}M`;
  return `${minutes}M`;
}

function StatusPill({ status }: { status: FantasyFighter['status'] }) {
  const m: Record<FantasyFighter['status'], { l: string; c: string }> = {
    active:        { l: 'Active', c: 'is-active' },
    questionable:  { l: 'Q',      c: 'is-q' },
    out:           { l: 'Out',    c: 'is-out' },
    free:          { l: 'FA',     c: 'is-fa' },
  };
  const x = m[status];
  return <span className={`fantasy-status-pill ${x.c}`}>{x.l}</span>;
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

  // Tick clock every 30s for the lineup-locks countdown.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const locksAt = new Date(locksAtISO).getTime();
  const msUntilLock = locksAt - now;
  const isLocked = msUntilLock <= 0 || resolved;

  const rosterById = useMemo(() => {
    const m = new Map<string, FantasyFighter>();
    roster.forEach((f) => m.set(f.id, f));
    return m;
  }, [roster]);

  // Map slot → fighter currently set there
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
    // If newFighterId is already starting elsewhere, swap them
    const existingIdx = next.indexOf(newFighterId);
    if (existingIdx >= 0 && existingIdx !== slotIdx) {
      next[existingIdx] = next[slotIdx]; // moves the displaced starter to the other slot
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
    <>
      <div className="fantasy-hero fantasy-hero--compact">
        <div>
          <div className="tbl-eyebrow" style={{ color: 'var(--tbl-accent-bright)' }}>
            My Team · Week {week}
          </div>
          <div className="tbl-display fantasy-hero__title">Throwing Hands FC</div>
          <div className="fantasy-hero__sub">
            {isLocked
              ? resolved
                ? `Week ${week} resolved — see Scoring`
                : `Lineup locked at ${new Date(locksAt).toLocaleString()}`
              : `Lineup locks in ${formatCountdown(msUntilLock)}`}
          </div>
        </div>
        <div className="fantasy-hero__stats">
          <div>
            <div className="fantasy-hero__stat-label">Projected</div>
            <div className="tbl-display fantasy-hero__stat-value">
              {totalProjected.toFixed(1)}
            </div>
          </div>
          <div>
            <div className="fantasy-hero__stat-label">Status</div>
            <div className="tbl-display fantasy-hero__stat-value">
              {isLocked ? '🔒' : 'Open'}
            </div>
          </div>
        </div>
      </div>

      <div className="fantasy-body">
        {error && (
          <div
            style={{
              background: 'var(--tbl-paper)',
              border: '1.5px solid var(--tbl-red)',
              color: 'var(--tbl-red)',
              padding: '10px 14px',
              fontFamily: 'var(--tbl-font-mono)',
              fontSize: 12,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <section className="fantasy-section">
          <div className="tbl-section-rule">
            <span>Active Lineup · 7 Slots</span>
            <span>{isLocked ? 'Locked' : 'Tap a slot to swap'}</span>
          </div>
          <div className="fantasy-lineup">
            {lineup.map((row) => {
              const slot = row.slot;
              const f = row.fighter;
              const eligibleBench = bench.filter((b) => slotEligible(slot, b));
              const isOpen = openSlot === slot;
              const isSaving = savingSlot === slot;
              return (
                <div key={slot}>
                  <div className="fantasy-lineup__row">
                    <div className="fantasy-lineup__slot">
                      <div className="fantasy-lineup__slot-label">
                        {SLOT_LABELS[slot]}
                      </div>
                      <div className="fantasy-lineup__slot-rule">
                        {SLOT_RULES[slot]}
                      </div>
                    </div>
                    {f ? (
                      <>
                        <div className="fantasy-lineup__fighter">
                          <div className="fantasy-lineup__name">{f.name}</div>
                          <div className="fantasy-lineup__meta">
                            {f.team} · {f.weightClass}
                          </div>
                        </div>
                        <StatusPill status={f.status} />
                        <div className="fantasy-lineup__proj">
                          <div className="fantasy-lineup__proj-label">Proj</div>
                          <div className="fantasy-lineup__proj-value">
                            {f.projected.toFixed(1)}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="fantasy-btn fantasy-btn--ghost"
                          disabled={isLocked || isSaving || eligibleBench.length === 0}
                          onClick={() => setOpenSlot(isOpen ? null : slot)}
                          style={{
                            opacity:
                              isLocked || eligibleBench.length === 0 ? 0.4 : 1,
                          }}
                        >
                          {isSaving ? 'Saving…' : isOpen ? 'Close' : 'Swap'}
                        </button>
                      </>
                    ) : (
                      <div className="fantasy-lineup__empty">
                        Empty slot — pick a fighter
                      </div>
                    )}
                  </div>
                  {isOpen && (
                    <div className="fantasy-swap-tray">
                      <div className="fantasy-swap-tray__head">
                        Eligible bench fighters
                      </div>
                      {eligibleBench.length === 0 ? (
                        <div
                          className="fantasy-empty"
                          style={{ padding: 14, fontSize: 11 }}
                        >
                          No bench fighters fit this slot. Draft someone or
                          claim a free agent.
                        </div>
                      ) : (
                        <div className="fantasy-swap-tray__grid">
                          {eligibleBench
                            .slice()
                            .sort((a, b) => b.projected - a.projected)
                            .map((b) => (
                              <button
                                key={b.id}
                                type="button"
                                className="fantasy-swap-card"
                                onClick={() => handleSwap(slot, b.id)}
                                disabled={isSaving}
                              >
                                <div className="fantasy-swap-card__name">
                                  {b.name}
                                </div>
                                <div className="fantasy-swap-card__meta">
                                  {b.team} · {b.weightClass}
                                </div>
                                <div className="fantasy-swap-card__proj">
                                  Proj {b.projected.toFixed(1)}
                                </div>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="fantasy-section">
          <div className="tbl-section-rule">
            <span>Bench · {bench.length} Reserves</span>
            <span>Use Swap above to start them</span>
          </div>
          <div className="fantasy-bench-grid">
            {bench.map((b) => (
              <div key={b.id} className="fantasy-bench-card">
                <div className="fantasy-bench-card__head">
                  <div>
                    <div className="fantasy-bench-card__name">{b.name}</div>
                    <div className="fantasy-bench-card__meta">
                      {b.team} · {b.weightClass}
                    </div>
                  </div>
                  <StatusPill status={b.status} />
                </div>
                <div className="fantasy-bench-card__body">
                  <div>
                    <div className="fantasy-bench-card__stat-label">Proj</div>
                    <div className="fantasy-bench-card__stat-value">
                      {b.projected.toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <div className="fantasy-bench-card__stat-label">Avg</div>
                    <div className="fantasy-bench-card__stat-value">
                      {b.avg.toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <div className="fantasy-bench-card__stat-label">Owned</div>
                    <div className="fantasy-bench-card__stat-value">
                      {b.owned}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {bench.length === 0 && (
              <div className="fantasy-empty">
                Every fighter on your roster is starting this week.
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
