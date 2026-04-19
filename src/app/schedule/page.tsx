// src/app/schedule/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllData, toSlug } from '@/lib/data';
import { getFullTeamName, getTeamLogoPath } from '@/lib/teams';
import { LogoImage } from '@/components/LogoImage';
import type { ScheduleEntry } from '@/types';

export const revalidate = 300;
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Schedule',
  description: 'Full 2026 Team Boxing League schedule. Upcoming matches, venues, dates, and results.',
  openGraph: {
    url: 'https://tblstats.com/schedule',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
};

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === 'completed') return <span className="badge badge-win" style={{ fontSize: 11 }}>Completed</span>;
  if (s === 'cancelled') return <span className="badge badge-loss" style={{ fontSize: 11 }}>Cancelled</span>;
  return (
    <span className="badge" style={{ fontSize: 11, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }}>
      Upcoming
    </span>
  );
}

function MatchRow({ entry }: { entry: ScheduleEntry }) {
  const t1Slug = toSlug(entry.team1);
  const t2Slug = toSlug(entry.team2);
  const t1Name = getFullTeamName(t1Slug) || entry.team1;
  const t2Name = getFullTeamName(t2Slug) || entry.team2;
  const isCompleted = entry.status.toLowerCase() === 'completed';
  const isCancelled = entry.status.toLowerCase() === 'cancelled';

  const formattedDate = (() => {
    try {
      return new Date(entry.date).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      });
    } catch { return entry.date; }
  })();

  const rowContent = (
    <div
      className="schedule-row"
      style={{ opacity: isCancelled ? 0.5 : 1 }}
    >
      {/* Week + date */}
      <div className="schedule-meta">
        {entry.week > 0 && (
          <span className="schedule-week">Wk {entry.week}</span>
        )}
        <span className="schedule-date">{formattedDate}</span>
        {entry.time && (
          <span className="schedule-time">{entry.time}</span>
        )}
      </div>

      {/* Matchup */}
      <div className="schedule-matchup">
        {/* Team 1 */}
        <div className="schedule-team">
          <LogoImage src={getTeamLogoPath(t1Slug)} alt={t1Name}
            style={{ width: 22, height: 22, objectFit: 'contain', flexShrink: 0 }} />
          <span className="schedule-team-name" style={{ fontWeight: 600 }}>{t1Name}</span>
        </div>

        <span className="schedule-vs">vs</span>

        {/* Team 2 */}
        <div className="schedule-team">
          <LogoImage src={getTeamLogoPath(t2Slug)} alt={t2Name}
            style={{ width: 22, height: 22, objectFit: 'contain', flexShrink: 0 }} />
          <span className="schedule-team-name" style={{ fontWeight: 600 }}>{t2Name}</span>
        </div>
      </div>

      {/* Venue */}
      <div className="schedule-venue">
        {entry.venueName && (
          <span style={{ fontWeight: 500 }}>{entry.venueName}</span>
        )}
        {entry.venueCity && (
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{entry.venueCity}</span>
        )}
      </div>

      {/* Status */}
      <div className="schedule-status">
        {statusBadge(entry.status)}
        {isCompleted && entry.matchIndex && (
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--accent)', marginLeft: 8 }}>
            Results →
          </span>
        )}
      </div>
    </div>
  );

  // Completed rows with a match link are clickable
  if (isCompleted && entry.matchIndex) {
    return (
      <Link href={`/matches/${entry.matchIndex}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
        {rowContent}
      </Link>
    );
  }

  return rowContent;
}

function WeekBlock({ week, entries }: { week: number; entries: ScheduleEntry[] }) {
  return (
    <div style={{ marginBottom: 32 }}>
      {week > 0 && (
        <div style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          marginBottom: 8,
          paddingBottom: 6,
          borderBottom: '1px solid var(--border)',
        }}>
          Week {week}
        </div>
      )}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {entries.map((entry, i) => (
          <div key={i} style={{ borderBottom: i < entries.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <MatchRow entry={entry} />
          </div>
        ))}
      </div>
    </div>
  );
}

function groupByWeek(entries: ScheduleEntry[]): [number, ScheduleEntry[]][] {
  const map = new Map<number, ScheduleEntry[]>();
  for (const entry of entries) {
    const w = entry.week || 0;
    if (!map.has(w)) map.set(w, []);
    map.get(w)!.push(entry);
  }
  return [...map.entries()];
}

export default async function SchedulePage() {
  const data = await getAllData();
  const { schedule } = data;

  const upcoming = schedule.filter((e) => e.status.toLowerCase() === 'upcoming');
  const past = schedule.filter((e) => e.status.toLowerCase() !== 'upcoming');

  // Upcoming: earliest weeks first; Past: most recent weeks first
  const upcomingWeeks = groupByWeek(upcoming).sort((a, b) => a[0] - b[0]);
  const pastWeeks = groupByWeek(past).sort((a, b) => b[0] - a[0]);

  const upcomingCount = upcoming.length;

  const BASE = 'https://tblstats.com';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'TBL Stats', item: BASE },
          { '@type': 'ListItem', position: 2, name: 'Schedule', item: `${BASE}/schedule` },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="page">
        <div className="container">
          <div className="page-header">
            <h1>Schedule</h1>
            <div className="subtitle">2026 TBL Season</div>
          </div>
          <p className="page-intro">
            Full 2026 Team Boxing League schedule. {upcomingCount > 0 ? `${upcomingCount} upcoming match${upcomingCount !== 1 ? 'es' : ''}.` : 'All matches completed.'} Click any completed match to view the full box score.
          </p>

          {schedule.length === 0 ? (
            <div className="card">
              <div className="loading">No schedule data available</div>
            </div>
          ) : (
            <>
              {/* ── Upcoming ── */}
              {upcomingWeeks.length > 0 ? (
                upcomingWeeks.map(([week, entries]) => (
                  <WeekBlock key={`up-${week}`} week={week} entries={entries} />
                ))
              ) : (
                <div className="card" style={{ marginBottom: 32 }}>
                  <div className="loading" style={{ padding: '20px 24px' }}>No upcoming matches scheduled</div>
                </div>
              )}

              {/* ── Past Matches divider ── */}
              {pastWeeks.length > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  margin: '32px 0 24px',
                }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                  }}>
                    Past Matches
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>
              )}

              {/* ── Past (most recent first) ── */}
              {pastWeeks.map(([week, entries]) => (
                <WeekBlock key={`past-${week}`} week={week} entries={entries} />
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}
