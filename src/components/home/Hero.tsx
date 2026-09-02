// src/components/home/Hero.tsx
// The top of the home page, in one component at every width.
//
// Two modes, chosen by the data rather than by the viewport:
//   poster — a match is genuinely upcoming, so it gets the full treatment.
//   strip  — nothing is scheduled, so the latest result (or the MegaBrawl
//            champion crowning) rides in a single band and the standings lead.
//
// This replaces FightCardHero + MobileMatchBanner, which had drifted apart:
// the champion crowning only ever existed in the desktop tree.

import Link from 'next/link';
import { getCityName, getTeamLogoPathByName } from '@/lib/teams';
import { shortAbbr, type HeroResult } from './shared';
import type { ScheduleEntry } from '@/types';

const MONO = 'var(--tbl-font-mono)';

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: MONO,
        fontSize: 11,
        letterSpacing: '0.28em',
        color: 'var(--tbl-accent-bright)',
        textTransform: 'uppercase',
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

function TeamLine({ team }: { team: string }) {
  return (
    <>
      <span className="gz-hero-team-full">{getCityName(team)}</span>
      <span className="gz-hero-team-abbr">{shortAbbr(team)}</span>
    </>
  );
}

function LogoPair({ team1, team2 }: { team1: string; team2: string }) {
  const logo1 = getTeamLogoPathByName(team1);
  const logo2 = getTeamLogoPathByName(team2);
  if (!logo1 && !logo2) return null;
  return (
    <div className="gz-hero-logos">
      {logo1 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo1} alt="" style={{ width: 60, height: 60, objectFit: 'contain' }} />
      )}
      <div className="gz-hero-x">×</div>
      {logo2 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo2} alt="" style={{ width: 60, height: 60, objectFit: 'contain' }} />
      )}
    </div>
  );
}

// ─── Strip: one band, no poster ──────────────────────────────────────────────
function Strip({ result }: { result: HeroResult | null }) {
  return (
    <div className="gz-hero-strip">
      <div style={{ minWidth: 0 }}>
        <Eyebrow>{result ? result.eyebrow : 'Team Boxing League · 2026 Season'}</Eyebrow>
        {result ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span className="tbl-display" style={{ fontSize: 30, lineHeight: 1.1 }}>
              {result.winnerName}
            </span>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 11,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(244,237,224,0.72)',
              }}
            >
              {result.verb} {result.loserName}{' '}
              <span style={{ color: 'var(--tbl-accent-bright)', fontWeight: 700 }}>
                {result.scoreLine}
              </span>
            </span>
          </div>
        ) : (
          <div className="tbl-display" style={{ fontSize: 30, lineHeight: 1.1 }}>
            Every Round. Every Fighter. Every Team.
          </div>
        )}
      </div>
      <Link
        href={result ? result.href : '/schedule'}
        style={{
          fontFamily: MONO,
          fontSize: 11,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--tbl-accent-bright)',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          fontWeight: 700,
        }}
      >
        {result ? (result.isChampion ? 'View bracket →' : 'View result →') : 'Schedule →'}
      </Link>
    </div>
  );
}

// ─── Poster: a fight is coming ───────────────────────────────────────────────
function Poster({
  featured,
  teamRecords,
}: {
  featured: ScheduleEntry;
  teamRecords: Map<string, string>;
}) {
  const rec1 = teamRecords.get(featured.team1) ?? '';
  const rec2 = teamRecords.get(featured.team2) ?? '';
  const href = featured.matchIndex ? `/matches/${featured.matchIndex}` : '/schedule';

  return (
    <div className="gz-hero-poster">
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(255,60,0,0.35) 1.5px, transparent 1.5px)',
          backgroundSize: '10px 10px',
          opacity: 0.12,
        }}
      />
      <div style={{ position: 'relative' }}>
        <Eyebrow>
          Next Event · {featured.date}
          {featured.time ? ` · ${featured.time}` : ''}
        </Eyebrow>

        <div className="tbl-display gz-hero-team" style={{ fontSize: 96, lineHeight: 0.9, marginTop: 16 }}>
          <TeamLine team={featured.team1} />
          <span className="gz-hero-vs">vs</span>
        </div>
        <div className="tbl-display gz-hero-team" style={{ fontSize: 96, lineHeight: 0.9, marginTop: -4 }}>
          <TeamLine team={featured.team2} />
        </div>

        {(rec1 || rec2) && (
          <div
            style={{
              marginTop: 14,
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: '0.16em',
              color: 'rgba(244,237,224,0.55)',
              textTransform: 'uppercase',
            }}
          >
            {shortAbbr(featured.team1)} {rec1 || '—'} · {shortAbbr(featured.team2)} {rec2 || '—'}
          </div>
        )}

        {featured.venueName && (
          <div
            style={{
              marginTop: 8,
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: '0.18em',
              color: 'rgba(244,237,224,0.55)',
              textTransform: 'uppercase',
            }}
          >
            {featured.venueName}
            {featured.venueCity && ` · ${featured.venueCity}`}
          </div>
        )}

        <Link
          href={href}
          style={{
            display: 'inline-block',
            marginTop: 20,
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--tbl-accent-bright)',
            textDecoration: 'none',
            fontWeight: 700,
          }}
        >
          Full schedule →
        </Link>
      </div>

      <LogoPair team1={featured.team1} team2={featured.team2} />
    </div>
  );
}

export function Hero({
  featured,
  heroResult,
  teamRecords,
}: {
  featured: ScheduleEntry | null;
  heroResult: HeroResult | null;
  teamRecords: Map<string, string>;
}) {
  if (featured) return <Poster featured={featured} teamRecords={teamRecords} />;
  return <Strip result={heroResult} />;
}
