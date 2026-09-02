// src/components/home/TopFighters.tsx
// The top six fighters by net points — six at every width.
//
// Replaces TopSix + MobileTopFighters, which showed six and four. The grid
// reflows (6 → 3 → 2 columns) rather than the count changing, so a phone and a
// desktop are looking at the same list.

import Link from 'next/link';
import { getCityName, getTeamLogoPathByName } from '@/lib/teams';
import type { FighterStat } from '@/types';

const MONO = 'var(--tbl-font-mono)';

function Stat({ label, value, isTop }: { label: string; value: string; isTop: boolean }) {
  return (
    <div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 9,
          letterSpacing: '0.18em',
          color: isTop ? 'rgba(244,237,224,0.5)' : 'var(--tbl-ink-mute)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        className="tbl-display"
        style={{
          fontSize: 18,
          lineHeight: 1,
          color:
            label === 'Net'
              ? isTop
                ? 'var(--tbl-accent-bright)'
                : 'var(--tbl-accent)'
              : isTop
              ? 'var(--tbl-bg)'
              : 'var(--tbl-ink)',
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function TopFighters({ fighters }: { fighters: FighterStat[] }) {
  if (fighters.length === 0) return null;

  return (
    <div style={{ padding: '26px 32px 24px', borderBottom: '3px double var(--tbl-ink)' }}>
      <div className="tbl-section-rule">
        <span>Pound for Pound · The Top Six</span>
        <Link href="/fighters" style={{ color: 'var(--tbl-ink-soft)', textDecoration: 'none' }}>
          Sorted by net points · View all →
        </Link>
      </div>

      <div
        className="gz-topsix-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          borderTop: '2px solid var(--tbl-ink)',
          borderLeft: '1px solid rgba(20,17,11,0.15)',
        }}
      >
        {fighters.slice(0, 6).map((f, i) => {
          const isTop = i === 0;
          const logo = getTeamLogoPathByName(f.team);
          return (
            <Link
              key={f.slug}
              href={`/fighters/${f.slug}`}
              className="gz-topsix-card"
              style={{
                borderRight: '1px solid rgba(20,17,11,0.15)',
                borderBottom: '1px solid rgba(20,17,11,0.15)',
                background: isTop ? 'var(--tbl-ink)' : 'var(--tbl-paper)',
                color: isTop ? 'var(--tbl-bg)' : 'var(--tbl-ink)',
              }}
            >
              <div>
                <div
                  className="tbl-display gz-topsix-rank"
                  style={{
                    color: isTop ? 'var(--tbl-accent-bright)' : 'rgba(20,17,11,0.18)',
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </div>
                {logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logo}
                    alt=""
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      width: 28,
                      height: 28,
                      objectFit: 'contain',
                    }}
                  />
                )}
              </div>
              <div>
                <div
                  className="tbl-display"
                  style={{
                    fontSize: 18,
                    lineHeight: 1.05,
                    fontWeight: 800,
                    color: isTop ? 'var(--tbl-bg)' : 'var(--tbl-ink)',
                  }}
                >
                  {f.name}
                </div>
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    letterSpacing: '0.16em',
                    color: isTop ? 'rgba(244,237,224,0.6)' : 'var(--tbl-ink-soft)',
                    marginTop: 4,
                    textTransform: 'uppercase',
                  }}
                >
                  {getCityName(f.team)} · {f.weightClass}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 6,
                  }}
                >
                  <Stat
                    label="Net"
                    value={`${f.netPts >= 0 ? '+' : ''}${f.netPts.toFixed(0)}`}
                    isTop={isTop}
                  />
                  <Stat label="Rec" value={f.record} isTop={isTop} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
