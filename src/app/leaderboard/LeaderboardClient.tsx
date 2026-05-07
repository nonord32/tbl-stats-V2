'use client';
// src/app/leaderboard/LeaderboardClient.tsx
//
// Gazette/newspaper-styled season pick'em leaderboard.
//   ┌──────────────────────────────────────────────────────────────────────┐
//   │ Eyebrow · Big serif title · subtitle      Pool / Scope controls →    │
//   ├──────────────────────────────────────────────────────────────────────┤
//   │ SEASON STANDINGS         │  YOUR POSITION                            │
//   │ rank · player · pts ·    │  big rank, gap from #1, week pts,         │
//   │ wk · acc · strk · trend  │  accuracy, streak                         │
//   │                          │  THIS WEEK'S PICKS · matchups + my pick   │
//   └──────────────────────────────────────────────────────────────────────┘

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { getCityName, getTeamLogoPathByName } from '@/lib/teams';

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

function shortAbbr(team: string): string {
  const city = getCityName(team).toUpperCase();
  const map: Record<string, string> = {
    'NEW YORK': 'NYC',
    NYC: 'NYC',
    'LOS ANGELES': 'LA',
    'LAS VEGAS': 'LV',
    'SAN ANTONIO': 'SA',
    ATLANTA: 'ATL',
    BOSTON: 'BOS',
    DALLAS: 'DAL',
    HOUSTON: 'HOU',
    MIAMI: 'MIA',
    NASHVILLE: 'NSH',
    PHILADELPHIA: 'PHI',
    PHOENIX: 'PHX',
  };
  return map[city] ?? city.slice(0, 3);
}

export interface LeaderRow {
  user_id: string;
  display_name: string | null;
  username: string;
  total_picks: number;
  total_points: number;
  correct_winners: number;
  exact_picks: number;
  win_pct: number | null;
  rank: number;
  trend: number | null;
  streak_kind: 'W' | 'L' | null;
  streak_count: number;
  last_week_points: number;
}

export interface ThisWeekMatchup {
  matchIndex: number;
  team1: string;
  team2: string;
  status: string;
  date: string;
  time: string;
  pickedTeam: string | null;
  pointsEarned: number | null;
  resolved: boolean;
  team1Score: number | null;
  team2Score: number | null;
}

interface LeaderboardClientProps {
  currentUserId: string | null;
  allTimeEntries: LeaderRow[];
  weekEntries: Record<number, LeaderRow[]>;
  resolvedWeeks: number[];
  thisWeek: number | null;
  thisWeekMatchups: ThisWeekMatchup[];
  totalEntrants: number;
}

const ROW_LIMIT = 25;

export function LeaderboardClient({
  currentUserId,
  allTimeEntries,
  weekEntries,
  resolvedWeeks,
  thisWeek,
  thisWeekMatchups,
  totalEntrants,
}: LeaderboardClientProps) {
  const [scope, setScope] = useState<'season' | number>('season');

  // Local override of the signed-in user's handle so the rename UI can update
  // optimistically without forcing a full server refetch.
  const [myUsernameOverride, setMyUsernameOverride] = useState<string | null>(null);

  const overrideRows = (rows: LeaderRow[]): LeaderRow[] => {
    if (!currentUserId || !myUsernameOverride) return rows;
    return rows.map((r) =>
      r.user_id === currentUserId ? { ...r, username: myUsernameOverride } : r
    );
  };
  const entries =
    scope === 'season'
      ? overrideRows(allTimeEntries)
      : overrideRows(weekEntries[scope] ?? []);
  const visible = entries.slice(0, ROW_LIMIT);

  const me = useMemo(() => {
    if (!currentUserId) return null;
    const base = allTimeEntries.find((e) => e.user_id === currentUserId) ?? null;
    if (base && myUsernameOverride) return { ...base, username: myUsernameOverride };
    return base;
  }, [currentUserId, allTimeEntries, myUsernameOverride]);
  const leader = allTimeEntries[0] ?? null;
  const gapFromLeader = me && leader ? me.total_points - leader.total_points : null;

  const lastResolvedWeek =
    resolvedWeeks.length > 0 ? resolvedWeeks[resolvedWeeks.length - 1] : null;
  const headerWeekLabel = thisWeek
    ? `Week ${thisWeek}`
    : lastResolvedWeek
    ? `Week ${lastResolvedWeek}`
    : 'Pre-season';
  const totalWeeks = resolvedWeeks.length || 0;

  return (
    <div className="tbl-page-body lb-root">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <header className="lb-header">
        <div>
          <div className="tbl-eyebrow">Season Pick&apos;em</div>
          <h1 className="tbl-page-header__title lb-title">Leaderboard</h1>
          <div className="lb-header__sub">
            {headerWeekLabel}
            {totalWeeks > 0 && <> · {totalWeeks} of {totalWeeks} weeks scored</>}
            {totalEntrants > 0 && (
              <>
                {' · '}
                {totalEntrants.toLocaleString()} active{' '}
                {totalEntrants === 1 ? 'entry' : 'entries'}
              </>
            )}
            {' · top '}
            {ROW_LIMIT} displayed
          </div>
        </div>
        <div className="lb-header__controls">
          <label className="lb-control">
            <span className="lb-control__label">Scope</span>
            <select
              className="filter-select lb-control__select"
              value={scope === 'season' ? 'season' : String(scope)}
              onChange={(e) => {
                const v = e.target.value;
                setScope(v === 'season' ? 'season' : Number(v));
              }}
            >
              <option value="season">Season</option>
              {[...resolvedWeeks].reverse().map((w) => (
                <option key={w} value={String(w)}>
                  Week {w}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {/* ── Two-column body ──────────────────────────────────────────────── */}
      <div className="lb-grid">
        {/* Left: standings */}
        <section className="lb-panel">
          <div className="tbl-section-rule">
            <span>
              {scope === 'season' ? 'Season Standings' : `Week ${scope} Standings`}
            </span>
            <span>
              Top {Math.min(ROW_LIMIT, entries.length || ROW_LIMIT)} displayed
            </span>
          </div>

          {entries.length === 0 ? (
            <div className="lb-empty">
              No picks have been resolved yet. Check back after the first match.
            </div>
          ) : (
            <div className="table-wrap">
              <table className="lb-table">
                <thead>
                  <tr>
                    <th className="lb-th lb-th--rank">#</th>
                    <th className="lb-th">Player</th>
                    <th className="lb-th lb-th--num">Pts</th>
                    <th className="lb-th lb-th--num col-hide-mobile">Wk</th>
                    <th className="lb-th lb-th--num col-hide-mobile">Acc</th>
                    <th className="lb-th lb-th--num col-hide-mobile">Strk</th>
                    <th className="lb-th lb-th--num">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((entry) => {
                    const isMe = !!currentUserId && entry.user_id === currentUserId;
                    return (
                      <tr key={entry.user_id} className={isMe ? 'lb-row is-me' : 'lb-row'}>
                        <td className="lb-rank">{entry.rank}</td>
                        <td className="lb-player">
                          <div className="lb-player__name">
                            {privacyName(entry.display_name, entry.username)}
                            {isMe && <span className="lb-player__you">(you)</span>}
                          </div>
                          <div className="lb-player__handle">@{entry.username}</div>
                        </td>
                        <td className="lb-pts">{entry.total_points}</td>
                        <td className="lb-num col-hide-mobile">
                          {entry.last_week_points}
                        </td>
                        <td className="lb-num col-hide-mobile">
                          {entry.win_pct !== null ? `${Math.round(entry.win_pct)}%` : '—'}
                        </td>
                        <td className="lb-num col-hide-mobile">
                          {entry.streak_kind ? (
                            <span
                              className={
                                entry.streak_kind === 'W'
                                  ? 'tbl-streak tbl-streak--win'
                                  : 'tbl-streak tbl-streak--loss'
                              }
                            >
                              {entry.streak_kind}
                              {entry.streak_count}
                            </span>
                          ) : (
                            <span className="lb-num__muted">—</span>
                          )}
                        </td>
                        <td className="lb-num">
                          {entry.trend === null ? (
                            <span className="lb-num__muted">—</span>
                          ) : entry.trend > 0 ? (
                            <span className="lb-trend lb-trend--up">+{entry.trend}</span>
                          ) : entry.trend < 0 ? (
                            <span className="lb-trend lb-trend--down">{entry.trend}</span>
                          ) : (
                            <span className="lb-trend lb-trend--flat">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Right: your-position + this-week picks */}
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
              <span>This Week&apos;s Picks</span>
              <span>{thisWeek ? `Week ${thisWeek}` : '—'}</span>
            </div>
            <ThisWeekPanel
              matchups={thisWeekMatchups}
              hasUser={!!currentUserId}
            />
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
  me: LeaderRow;
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
        <div className="lb-you__pts tbl-display">{me.total_points}</div>
        <div className="lb-you__sub">
          Season Points
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
        <Stat label="This Week" value={String(me.last_week_points)} />
        <Stat
          label="Accuracy"
          value={me.win_pct !== null ? `${Math.round(me.win_pct)}%` : '—'}
        />
        <Stat
          label="Streak"
          value={
            me.streak_kind ? `${me.streak_kind}${me.streak_count}` : '—'
          }
          tone={me.streak_kind === 'W' ? 'win' : me.streak_kind === 'L' ? 'loss' : undefined}
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

function SignedOutPanel() {
  return (
    <div className="lb-you lb-you--out">
      <div className="lb-you__sub" style={{ fontSize: 12 }}>
        Sign in and lock in your picks to see your standing here.
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <Link href="/login" className="tbl-btn">
          Sign in
        </Link>
        <Link href="/picks" className="tbl-btn tbl-btn--primary">
          Make picks
        </Link>
      </div>
    </div>
  );
}

// ── This-Week panel ──────────────────────────────────────────────────────────
function ThisWeekPanel({
  matchups,
  hasUser,
}: {
  matchups: ThisWeekMatchup[];
  hasUser: boolean;
}) {
  if (matchups.length === 0) {
    return (
      <div className="lb-empty">
        No matchups scheduled. Check back when the next week is posted.
      </div>
    );
  }
  return (
    <div className="lb-week">
      {matchups.map((m) => (
        <Link key={m.matchIndex} href={`/matches/${m.matchIndex}`} className="lb-week__row">
          <div className="lb-week__teams">
            <TeamMini name={m.team1} />
            <span className="lb-week__vs">vs</span>
            <TeamMini name={m.team2} />
          </div>
          <div className="lb-week__pick">
            {m.pickedTeam ? (
              <PickBadge
                pickedTeam={m.pickedTeam}
                pointsEarned={m.pointsEarned}
                resolved={m.resolved}
              />
            ) : hasUser ? (
              <span className="lb-week__none">No pick</span>
            ) : (
              <span className="lb-week__none">{m.time || m.date}</span>
            )}
          </div>
        </Link>
      ))}
      {hasUser && (
        <Link href="/picks" className="lb-week__cta">
          Manage your picks →
        </Link>
      )}
      {!hasUser && (
        <Link href="/picks" className="lb-week__cta">
          Make your picks →
        </Link>
      )}
    </div>
  );
}

function TeamMini({ name }: { name: string }) {
  const logo = getTeamLogoPathByName(name);
  return (
    <span className="lb-week__team">
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="lb-week__logo" />
      )}
      <span className="lb-week__abbr">{shortAbbr(name)}</span>
    </span>
  );
}

function PickBadge({
  pickedTeam,
  pointsEarned,
  resolved,
}: {
  pickedTeam: string;
  pointsEarned: number | null;
  resolved: boolean;
}) {
  const abbr = shortAbbr(pickedTeam);
  if (!resolved) {
    return (
      <span className="lb-pick lb-pick--locked">
        <span className="lb-pick__abbr">{abbr}</span>
        <span className="lb-pick__pts">—</span>
      </span>
    );
  }
  const pts = pointsEarned ?? 0;
  const tone = pts >= 2 ? 'win-strong' : pts >= 1 ? 'win' : 'loss';
  return (
    <span
      className={
        tone === 'win-strong'
          ? 'lb-pick lb-pick--win-strong'
          : tone === 'win'
          ? 'lb-pick lb-pick--win'
          : 'lb-pick lb-pick--loss'
      }
    >
      <span className="lb-pick__abbr">{abbr}</span>
      <span className="lb-pick__pts">{pts}</span>
    </span>
  );
}

