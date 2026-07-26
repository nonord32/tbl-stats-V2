'use client';
// src/app/leaderboard/LeaderboardClient.tsx
//
// Gazette/newspaper-styled Bracket Challenge leaderboard. Ranks every entrant by
// bracket points (1 pt QF · 2 pt SF · 4 pt Final), with the combined-final-score
// guess as the NCAA-style tiebreaker. Scoring is computed live from the playoff
// results, so standings fill in round by round.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { BracketLeaderRow } from '@/types';

// Privacy: show first name + last initial. Usernames stay as-is.
function privacyName(displayName: string | null, username: string): string {
  const raw = (displayName || '').trim();
  if (!raw) return username;
  const parts = raw.split(/\s+/);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${first} ${lastInitial}.`;
}

export interface LeaderboardClientProps {
  currentUserId: string | null;
  entries: BracketLeaderRow[];
  totalEntrants: number;
  maxPoints: number;
  championName: string | null;
  finalTotalActual: number | null;
  bracketOpen: boolean;
}

const ROW_LIMIT = 50;

export function LeaderboardClient({
  currentUserId,
  entries,
  totalEntrants,
  maxPoints,
  championName,
  finalTotalActual,
  bracketOpen,
}: LeaderboardClientProps) {
  const [myUsernameOverride, setMyUsernameOverride] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (!currentUserId || !myUsernameOverride) return entries;
    return entries.map((r) =>
      r.user_id === currentUserId ? { ...r, username: myUsernameOverride } : r
    );
  }, [entries, currentUserId, myUsernameOverride]);

  const visible = rows.slice(0, ROW_LIMIT);

  const me = useMemo(() => {
    if (!currentUserId) return null;
    return rows.find((e) => e.user_id === currentUserId) ?? null;
  }, [rows, currentUserId]);

  const leader = rows[0] ?? null;
  const gapFromLeader = me && leader ? me.points - leader.points : null;

  const statusLabel = championName
    ? `Champion: ${championName}`
    : finalTotalActual != null
    ? 'Final decided'
    : bracketOpen
    ? 'Entries open'
    : 'In progress';

  // While entries are still open, keep each player's champion pick and
  // tiebreaker number hidden so nobody can copy them — they reveal once the
  // bracket locks.
  const revealPicks = !bracketOpen;

  return (
    <div className="tbl-page-body lb-root">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <header className="lb-header">
        <div>
          <div className="tbl-eyebrow">Bracket Challenge</div>
          <h1 className="tbl-page-header__title lb-title">Leaderboard</h1>
          <div className="lb-header__sub">
            {statusLabel}
            {totalEntrants > 0 && (
              <>
                {' · '}
                {totalEntrants.toLocaleString()}{' '}
                {totalEntrants === 1 ? 'entry' : 'entries'}
              </>
            )}
            {' · '}
            {maxPoints} pts possible
            {!revealPicks && <> · champion &amp; tiebreaker reveal at lock</>}
          </div>
        </div>
        <div className="lb-header__controls">
          <Link href="/bracket" className="tbl-btn tbl-btn--primary">
            {bracketOpen ? 'Fill your bracket' : 'View your bracket'}
          </Link>
        </div>
      </header>

      {/* ── Two-column body ──────────────────────────────────────────────── */}
      <div className="lb-grid">
        {/* Left: standings */}
        <section className="lb-panel">
          <div className="tbl-section-rule">
            <span>Standings</span>
            <span>Top {Math.min(ROW_LIMIT, rows.length || ROW_LIMIT)} displayed</span>
          </div>

          {rows.length === 0 ? (
            <div className="lb-empty">
              No brackets submitted yet. Be the first — fill yours out before the playoffs tip off.
            </div>
          ) : (
            <div className="table-wrap">
              <table className="lb-table">
                <thead>
                  <tr>
                    <th className="lb-th lb-th--rank">#</th>
                    <th className="lb-th">Player</th>
                    <th className="lb-th lb-th--num">Pts</th>
                    <th className="lb-th lb-th--num col-hide-mobile">QF</th>
                    <th className="lb-th lb-th--num col-hide-mobile">SF</th>
                    {revealPicks && (
                      <>
                        <th className="lb-th lb-th--num col-hide-mobile">Champ</th>
                        <th className="lb-th lb-th--num">TB</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((entry) => {
                    const isMe = !!currentUserId && entry.user_id === currentUserId;
                    return (
                      <tr key={entry.user_id} className={isMe ? 'lb-row is-me' : 'lb-row'}>
                        <td className="lb-rank">{entry.rank}</td>
                        <td className="lb-player">
                          {revealPicks ? (
                            <Link
                              href={`/bracket/${encodeURIComponent(entry.username)}`}
                              className="lb-player__link"
                              title={`View @${entry.username}'s bracket`}
                            >
                              <div className="lb-player__name">
                                {privacyName(entry.display_name, entry.username)}
                                {isMe && <span className="lb-player__you">(you)</span>}
                              </div>
                              <div className="lb-player__handle">@{entry.username} →</div>
                            </Link>
                          ) : (
                            <>
                              <div className="lb-player__name">
                                {privacyName(entry.display_name, entry.username)}
                                {isMe && <span className="lb-player__you">(you)</span>}
                              </div>
                              <div className="lb-player__handle">@{entry.username}</div>
                            </>
                          )}
                        </td>
                        <td className="lb-pts">{entry.points}</td>
                        <td className="lb-num col-hide-mobile">{entry.qf_correct}/4</td>
                        <td className="lb-num col-hide-mobile">{entry.sf_correct}/2</td>
                        {revealPicks && (
                          <>
                            <td className="lb-num col-hide-mobile">
                              {entry.champ_correct ? (
                                <span className="tbl-streak tbl-streak--win">✓</span>
                              ) : (
                                <span className="lb-num__muted">—</span>
                              )}
                            </td>
                            <td className="lb-num">
                              {entry.final_total != null ? (
                                <>
                                  {entry.final_total}
                                  {entry.tiebreak_diff != null && (
                                    <span className="lb-num__muted"> ({entry.tiebreak_diff})</span>
                                  )}
                                </>
                              ) : (
                                <span className="lb-num__muted">—</span>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Right: your-position */}
        <aside className="lb-aside">
          <div className="lb-card">
            <div className="tbl-section-rule">
              <span>Your Position</span>
              <span>{me ? `@${me.username}` : 'Sign in'}</span>
            </div>
            {me ? (
              <YourPosition
                me={me}
                gapFromLeader={gapFromLeader}
                totalEntrants={totalEntrants}
                onRename={setMyUsernameOverride}
              />
            ) : (
              <SignedOutPanel />
            )}
          </div>

          <div className="lb-card">
            <div className="tbl-section-rule">
              <span>How scoring works</span>
              <span>{maxPoints} max</span>
            </div>
            <div className="lb-scoring">
              <ScoreLine label="Each quarterfinal winner" value="1 pt" />
              <ScoreLine label="Each semifinal winner" value="2 pts" />
              <ScoreLine label="Champion (the Final)" value="4 pts" />
              <ScoreLine
                label="Tiebreaker"
                value="Closest to the combined final score"
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── Your-Position panel ──────────────────────────────────────────────────────
function YourPosition({
  me,
  gapFromLeader,
  totalEntrants,
  onRename,
}: {
  me: BracketLeaderRow;
  gapFromLeader: number | null;
  totalEntrants: number;
  onRename: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(me.username);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setDraft(me.username);
    setError(null);
    setEditing(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/profile/username', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: draft.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? 'Could not update username.');
        return;
      }
      onRename(json.username);
      setEditing(false);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="lb-you">
      <div className="lb-you__head">
        <div className="lb-you__eyebrow">
          You · Rank {me.rank} of {totalEntrants.toLocaleString()}
        </div>
        <div className="lb-you__pts tbl-display">{me.points}</div>
        <div className="lb-you__sub">
          Bracket Points
          {gapFromLeader !== null && gapFromLeader !== 0 && (
            <>
              {' · '}
              <span className={gapFromLeader < 0 ? 'lb-trend--down' : 'lb-trend--up'}>
                {gapFromLeader > 0 ? '+' : ''}
                {gapFromLeader}
              </span>{' '}
              from #1
            </>
          )}
          {gapFromLeader === 0 && ' · Leading'}
        </div>
      </div>

      {/* Editable handle row */}
      <div className="lb-handle">
        {!editing ? (
          <>
            <span className="lb-handle__value">@{me.username}</span>
            <button
              type="button"
              className="lb-handle__edit"
              onClick={startEdit}
              aria-label="Edit username"
            >
              Edit
            </button>
          </>
        ) : (
          <form onSubmit={save} className="lb-handle__form">
            <span className="lb-handle__at">@</span>
            <input
              autoFocus
              className="lb-handle__input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={20}
              disabled={saving}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
            />
            <button type="submit" className="lb-handle__save" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className="lb-handle__cancel"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              Cancel
            </button>
          </form>
        )}
        {error && <div className="lb-handle__error">{error}</div>}
        {editing && !error && (
          <div className="lb-handle__hint">3–20 chars · letters, numbers, underscore</div>
        )}
      </div>

      <div className="lb-you__stats">
        <Stat label="QF" value={`${me.qf_correct}/4`} />
        <Stat label="SF" value={`${me.sf_correct}/2`} />
        <Stat
          label="Champ"
          value={me.champ_correct ? '✓' : '—'}
          tone={me.champ_correct ? 'win' : undefined}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'win' | 'loss';
}) {
  return (
    <div className="lb-stat">
      <div className="lb-stat__label">{label}</div>
      <div
        className={
          tone === 'win'
            ? 'lb-stat__value lb-stat__value--win tbl-display'
            : tone === 'loss'
            ? 'lb-stat__value lb-stat__value--loss tbl-display'
            : 'lb-stat__value tbl-display'
        }
      >
        {value}
      </div>
    </div>
  );
}

function ScoreLine({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 12,
        padding: '8px 0',
        borderBottom: '1px solid var(--tbl-rule, rgba(0,0,0,0.08))',
        fontFamily: 'var(--tbl-font-mono)',
        fontSize: 12,
      }}
    >
      <span style={{ color: 'var(--tbl-ink-soft)' }}>{label}</span>
      <span style={{ fontWeight: 700, color: 'var(--tbl-ink)' }}>{value}</span>
    </div>
  );
}

function SignedOutPanel() {
  return (
    <div className="lb-you lb-you--out">
      <div className="lb-you__sub" style={{ fontSize: 12 }}>
        Sign in and fill out your bracket to see your standing here.
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <Link href="/login" className="tbl-btn">
          Sign in
        </Link>
        <Link href="/bracket" className="tbl-btn tbl-btn--primary">
          Fill your bracket
        </Link>
      </div>
    </div>
  );
}
