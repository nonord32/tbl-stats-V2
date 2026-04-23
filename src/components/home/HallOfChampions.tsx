// src/components/home/HallOfChampions.tsx
// Home-page card summarizing the most recent award winners. Full list lives
// on /awards.

import Link from 'next/link';
import { toSlug } from '@/lib/data';
import type { AwardEntry } from '@/types';

interface Props {
  awards: AwardEntry[];
  /** Max rows to render. Defaults to 5. */
  limit?: number;
}

export function HallOfChampions({ awards, limit = 5 }: Props) {
  if (awards.length === 0) return null;

  const sorted = [...awards]
    .sort((a, b) => b.season - a.season || a.award.localeCompare(b.award))
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
              <th style={{ width: 28 }}>#</th>
              <th>Year</th>
              <th>Award</th>
              <th>Winner</th>
              <th>Team</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((a, i) => (
              <tr key={`${a.season}-${a.award}-${a.winner}`}>
                <td className="rank-cell">{i + 1}</td>
                <td className="mono">{a.season}</td>
                <td className="mono">{a.award}</td>
                <td>
                  <Link
                    href={`/fighters/${toSlug(a.winner)}`}
                    style={{ color: 'var(--accent)', fontWeight: 600 }}
                  >
                    {a.winner}
                  </Link>
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{a.team}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
