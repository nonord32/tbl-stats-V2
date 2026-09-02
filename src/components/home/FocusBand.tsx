// src/components/home/FocusBand.tsx
// Fighter in Focus and the rest of the week's card, side by side.
//
// Both lived in the right rail of the old desktop-only hero, so phones never
// saw either. With the standings leading the page the rail had nowhere to go,
// so it became a band of its own — visible at every width.

import Link from 'next/link';
import { StatTile } from '@/components/ui';
import { getFullTeamName } from '@/lib/teams';
import { firstName, lastName, teamSlug } from './shared';
import type { FighterStat, ScheduleEntry } from '@/types';

const MONO = 'var(--tbl-font-mono)';

function FighterInFocus({ focus }: { focus: FighterStat }) {
  return (
    <div>
      <div className="tbl-eyebrow">Fighter in Focus</div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          marginTop: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <Link
            href={`/fighters/${focus.slug}`}
            className="tbl-display gz-hero-focus-name"
            style={{
              fontSize: 52,
              lineHeight: 0.95,
              color: 'var(--tbl-ink)',
              display: 'block',
              textDecoration: 'none',
            }}
          >
            {firstName(focus.name)}
            <br />
            {lastName(focus.name)}
          </Link>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: '0.18em',
              color: 'var(--tbl-ink-soft)',
              textTransform: 'uppercase',
              marginTop: 10,
            }}
          >
            {getFullTeamName(teamSlug(focus.team))} · {focus.weightClass}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            className="tbl-display gz-hero-net"
            style={{ fontSize: 68, lineHeight: 0.9, color: 'var(--tbl-accent)' }}
          >
            {focus.netPts >= 0 ? '+' : ''}
            {focus.netPts.toFixed(0)}
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: '0.3em',
              color: 'var(--tbl-ink-soft)',
              fontWeight: 700,
            }}
          >
            NET PTS
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          borderTop: '2px solid var(--tbl-ink)',
          borderBottom: '2px solid var(--tbl-ink)',
        }}
      >
        {[
          { label: 'Rec', value: focus.record },
          { label: 'WAR', value: focus.war.toFixed(2) },
          { label: 'NPPR', value: focus.nppr.toFixed(2) },
          { label: 'Win%', value: `${(focus.winPct * 100).toFixed(0)}` },
          { label: 'Rnds', value: String(focus.rounds) },
        ].map((s, i) => (
          <div
            key={s.label}
            style={{
              padding: '10px 6px',
              borderRight: i < 4 ? '1px solid rgba(20,17,11,0.18)' : 'none',
            }}
          >
            <StatTile
              label={s.label}
              value={s.value}
              size="md"
              tone="mute"
              orientation="stacked"
              align="center"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function AlsoThisWeek({ matches }: { matches: ScheduleEntry[] }) {
  return (
    <div>
      <div className="tbl-eyebrow">Also This Week</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
        {matches.slice(0, 4).map((m, i, arr) => (
          <div
            key={`${m.date}-${m.team1}-${m.team2}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '84px 1fr auto',
              alignItems: 'center',
              gap: 12,
              padding: '7px 0',
              borderBottom: i < arr.length - 1 ? '1px dotted rgba(20,17,11,0.3)' : 'none',
            }}
          >
            <div
              style={{
                fontFamily: MONO,
                fontSize: 10,
                letterSpacing: '0.14em',
                color: 'var(--tbl-ink-soft)',
                textTransform: 'uppercase',
              }}
            >
              {m.date}
            </div>
            <div className="tbl-display" style={{ fontSize: 15, fontWeight: 700 }}>
              {m.team1}{' '}
              <span style={{ fontStyle: 'italic', fontWeight: 400, color: 'var(--tbl-ink-soft)' }}>
                vs
              </span>{' '}
              {m.team2}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: 'var(--tbl-ink-soft)' }}>
              {m.time}
            </div>
          </div>
        ))}
      </div>
      <Link
        href="/schedule"
        style={{
          display: 'inline-block',
          marginTop: 14,
          fontFamily: MONO,
          fontSize: 11,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--tbl-ink-soft)',
          textDecoration: 'none',
        }}
      >
        Full schedule →
      </Link>
    </div>
  );
}

export function FocusBand({
  focus,
  alsoThisWeek,
}: {
  focus: FighterStat | null;
  alsoThisWeek: ScheduleEntry[];
}) {
  if (!focus && alsoThisWeek.length === 0) return null;
  const twoUp = focus != null && alsoThisWeek.length > 0;

  return (
    <div
      className="gz-focus-band"
      style={{
        padding: '26px 32px 28px',
        borderBottom: '3px double var(--tbl-ink)',
        display: 'grid',
        gridTemplateColumns: twoUp ? '1.2fr 1fr' : '1fr',
        gap: 32,
      }}
    >
      {focus && <FighterInFocus focus={focus} />}
      {alsoThisWeek.length > 0 && <AlsoThisWeek matches={alsoThisWeek} />}
    </div>
  );
}
