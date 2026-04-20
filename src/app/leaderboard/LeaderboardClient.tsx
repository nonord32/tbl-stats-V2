'use client';
// src/app/leaderboard/LeaderboardClient.tsx

import { useState } from 'react';

// Privacy: show only first name + last initial (e.g. "John Doe" -> "John D.")
// Usernames (no space, often auto-generated) are shown as-is.
function privacyName(displayName: string | null, username: string): string {
  const raw = (displayName || '').trim();
  if (!raw) return username;
  const parts = raw.split(/\s+/);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${first} ${lastInitial}.`;
}

interface LeaderRow {
  user_id: string;
  display_name: string | null;
  username: string;
  total_picks: number;
  total_points: number;
  correct_winners: number;
  exact_picks: number;
  win_pct: number | null;
}

interface LeaderboardClientProps {
  currentUserId: string | null;
  allTimeEntries: LeaderRow[];
  weekEntries: Record<number, LeaderRow[]>;
  resolvedWeeks: number[];
}

export function LeaderboardClient({
  currentUserId,
  allTimeEntries,
  weekEntries,
  resolvedWeeks,
}: LeaderboardClientProps) {
  const [selectedWeek, setSelectedWeek] = useState<number | 'all'>('all');

  const entries = selectedWeek === 'all' ? allTimeEntries : (weekEntries[selectedWeek] ?? []);

  const tabs: Array<{ key: number | 'all'; label: string }> = [
    { key: 'all', label: 'All Time' },
    ...resolvedWeeks.map((w) => ({ key: w, label: `Week ${w}` })),
  ];

  return (
    <>
      {/* Week tabs */}
      {resolvedWeeks.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedWeek(tab.key)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 700,
                padding: '6px 14px',
                borderRadius: 'var(--radius)',
                border: `1px solid ${selectedWeek === tab.key ? 'var(--accent)' : 'var(--border)'}`,
                background: selectedWeek === tab.key ? 'var(--accent)' : 'transparent',
                color: selectedWeek === tab.key ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {entries.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>
            No picks have been resolved yet. Check back after the first match.
          </p>
        </div>
      )}

      {entries.length > 0 && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="rank-cell">#</th>
                  <th>User</th>
                  <th className="num-cell">Points</th>
                  <th className="num-cell col-hide-mobile">Correct Wins</th>
                  <th className="num-cell col-hide-mobile">Exact</th>
                  <th className="num-cell">Win%</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => {
                  const isMe = !!currentUserId && entry.user_id === currentUserId;
                  return (
                    <tr key={entry.user_id} className={isMe ? 'leaderboard-me' : ''}>
                      <td className="rank-cell">{idx + 1}</td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: isMe ? 700 : 400, color: isMe ? 'var(--accent)' : 'var(--text)' }}>
                          {privacyName(entry.display_name, entry.username)}
                        </span>
                        {isMe && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', marginLeft: 6, opacity: 0.7 }}>
                            (you)
                          </span>
                        )}
                      </td>
                      <td className="num-cell" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-heading)' }}>
                        {entry.total_points}
                      </td>
                      <td className="num-cell col-hide-mobile" style={{ fontFamily: 'var(--font-mono)' }}>
                        {entry.correct_winners}/{entry.total_picks}
                      </td>
                      <td className="num-cell col-hide-mobile" style={{ fontFamily: 'var(--font-mono)' }}>
                        {entry.exact_picks}
                      </td>
                      <td className="num-cell" style={{ fontFamily: 'var(--font-mono)', color: entry.win_pct !== null && entry.win_pct >= 60 ? 'var(--result-w)' : 'var(--text)' }}>
                        {entry.win_pct !== null ? `${entry.win_pct}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
