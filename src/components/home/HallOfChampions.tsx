// src/components/home/HallOfChampions.tsx
// Home-page card summarizing the most recent winner of every season award.
// One row per category, ordered to match the /awards page. Full history
// lives on /awards.

import Link from 'next/link';
import { toSlug } from '@/lib/data';
import {
  TEAM_AWARDS,
  awardOrderIndex,
  normalizeAwardName,
} from '@/lib/awards';
import { getTeamSlugByName } from '@/lib/teams';
import type { AwardEntry } from '@/types';

interface Props {
  awards: AwardEntry[];
  /** Slugs of fighters present in the current roster — winners not in this
   *  set render as plain text instead of a broken link. */
  fighterSlugs?: Set<string>;
  /** Max categories to render. Defaults to 5. */
  limit?: number;
}

export function HallOfChampions({ awards, fighterSlugs, limit = 5 }: Props) {
  if (awards.length === 0) return null;

  // Group by normalized category, then keep the most recent winner per group.
  const byAward = new Map<string, AwardEntry[]>();
  for (const a of awards) {
    const key = normalizeAwardName(a.award);
    if (!byAward.has(key)) byAward.set(key, []);
    byAward.get(key)!.push(a);
  }

  const latestPerAward = [...byAward.entries()]
    .map(([award, entries]) => {
      const latest = [...entries].sort((a, b) => b.season - a.season)[0];
      return { award, entry: latest };
    })
    .sort((a, b) => {
      const oa = awardOrderIndex(a.award);
      const ob = awardOrderIndex(b.award);
      if (oa !== ob) return oa - ob;
      return a.award.localeCompare(b.award);
    })
    .slice(0, limit);

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Hall of Champions</span>
        <Link
          href="/awards"
          style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 11,
            color: 'var(--accent)',
            letterSpacing: '0.04em',
          }}
        >
          View all →
        </Link>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Year</th>
              <th>Award</th>
              <th>Winner</th>
              <th>Team</th>
            </tr>
          </thead>
          <tbody>
            {latestPerAward.map(({ award, entry: a }) => {
              const isTeamAward = TEAM_AWARDS.has(award);
              const slug = toSlug(a.winner);
              const linkable =
                !isTeamAward && (!fighterSlugs || fighterSlugs.has(slug));
              const winnerTeamSlug =
                getTeamSlugByName(a.winner) || getTeamSlugByName(a.team);
              const teamLinkSlug = getTeamSlugByName(a.team);
              return (
                <tr key={`${award}-${a.season}-${a.winner}`}>
                  <td className="mono">{a.season}</td>
                  <td className="mono">{award}</td>
                  <td>
                    {linkable ? (
                      <Link
                        href={`/fighters/${slug}`}
                        style={{ color: 'var(--accent)', fontWeight: 600 }}
                      >
                        {a.winner}
                      </Link>
                    ) : isTeamAward && winnerTeamSlug ? (
                      <Link
                        href={`/teams/${winnerTeamSlug}`}
                        style={{ color: 'var(--accent)', fontWeight: 600 }}
                      >
                        {a.winner}
                      </Link>
                    ) : (
                      <span style={{ fontWeight: 600 }}>{a.winner}</span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {teamLinkSlug ? (
                      <Link
                        href={`/teams/${teamLinkSlug}`}
                        style={{ color: 'inherit', textDecoration: 'none' }}
                      >
                        {a.team}
                      </Link>
                    ) : (
                      a.team
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
