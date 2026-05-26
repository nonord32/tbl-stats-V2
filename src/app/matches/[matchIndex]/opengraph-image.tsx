// src/app/matches/[matchIndex]/opengraph-image.tsx
// Dynamic Open Graph card for /matches/<id> — when the URL is shared on
// iMessage / Twitter / Discord, the preview renders the actual teams,
// score, week, and date. Mirrors the dark gazette match-hero band.
import { ImageResponse } from 'next/og';
import { getMatchByIndex, toSlug } from '@/lib/data';
import { getFullTeamName } from '@/lib/teams';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'TBL Stats — Match Box Score';

const INK = '#14110b';
const PAPER = '#f4ede0';
const ACCENT_BRIGHT = '#ff5b1f';
const MUTED = 'rgba(244,237,224,0.55)';

function splitName(full: string): [string, string] {
  const parts = full.split(' ');
  if (parts.length < 2) return [full, ''];
  return [parts.slice(0, -1).join(' '), parts[parts.length - 1]];
}

function formatDate(date: string): string {
  try {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return date;
  }
}

export default async function MatchOG({
  params,
}: {
  params: { matchIndex: string };
}) {
  const mi = parseInt(params.matchIndex, 10);
  const result = isNaN(mi) ? null : await getMatchByIndex(mi);

  // Fallback card if match is missing — keeps social previews from showing
  // a broken image when someone shares a bad URL.
  if (!result) {
    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            background: INK,
            color: PAPER,
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'serif',
            fontSize: 72,
            letterSpacing: '0.04em',
          }}
        >
          TBL Stats
        </div>
      ),
      { ...size },
    );
  }

  const { match, scheduleEntry } = result;
  const team1Slug = toSlug(match.team1);
  const team2Slug = toSlug(match.team2);
  const team1Full = getFullTeamName(team1Slug) || match.team1;
  const team2Full = getFullTeamName(team2Slug) || match.team2;
  const [team1Front, team1Back] = splitName(team1Full);
  const [team2Front, team2Back] = splitName(team2Full);

  const totalA = match.score1;
  const totalB = match.score2;
  const hasScore = totalA > 0 || totalB > 0;
  const isDraw = hasScore && (match.result === 'D' || Math.abs(totalA - totalB) < 0.0001);
  const team1Won = hasScore && !isDraw && match.result === 'W';
  const team2Won = hasScore && !isDraw && match.result === 'L';

  const status = hasScore ? 'Final' : 'Scheduled';
  const dateStr = formatDate(match.date);
  const eyebrow = [
    status,
    scheduleEntry?.week ? `Week ${scheduleEntry.week}` : null,
    dateStr,
    scheduleEntry?.venueName
      ? `${scheduleEntry.venueName}${
          scheduleEntry.venueCity ? ` · ${scheduleEntry.venueCity}` : ''
        }`
      : null,
  ]
    .filter(Boolean)
    .join(' · ')
    .toUpperCase();

  // Absolute URLs for logos — next/og can't read /public via relative paths.
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_URL ||
    'https://tblstats.com';
  const baseUrl = base.startsWith('http') ? base : `https://${base}`;
  const team1Logo = `${baseUrl}/logos/${team1Slug}.png`;
  const team2Logo = `${baseUrl}/logos/${team2Slug}.png`;

  const scoreColor1 = team1Won ? ACCENT_BRIGHT : PAPER;
  const scoreColor2 = team2Won ? ACCENT_BRIGHT : PAPER;

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: INK,
          color: PAPER,
          padding: '60px 80px',
          fontFamily: 'serif',
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            color: ACCENT_BRIGHT,
            fontSize: 22,
            letterSpacing: '0.28em',
            fontWeight: 700,
            textTransform: 'uppercase',
            fontFamily: 'monospace',
          }}
        >
          {eyebrow}
        </div>

        {/* Main row: team1 | score | team2 */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 30,
          }}
        >
          {/* Team 1 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              justifyContent: 'center',
              width: 370,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={team1Logo}
              alt=""
              width={140}
              height={140}
              style={{ objectFit: 'contain' }}
            />
            <div
              style={{
                fontSize: 56,
                fontWeight: 700,
                lineHeight: 1,
                marginTop: 18,
                textAlign: 'right',
                color: team1Won ? PAPER : isDraw ? PAPER : 'rgba(244,237,224,0.85)',
              }}
            >
              {team1Front}
              {team1Back ? (
                <span style={{ opacity: 0.7 }}> {team1Back}</span>
              ) : (
                ''
              )}
            </div>
            <div
              style={{
                marginTop: 14,
                fontSize: 18,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                fontWeight: 700,
                fontFamily: 'monospace',
                color: team1Won
                  ? ACCENT_BRIGHT
                  : isDraw
                  ? 'rgba(244,237,224,0.75)'
                  : MUTED,
              }}
            >
              {team1Won ? 'Winner' : team2Won ? 'Loser' : isDraw ? 'Draw' : ' '}
            </div>
          </div>

          {/* Score */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 180,
              fontWeight: 900,
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
          >
            {hasScore ? (
              <>
                <span style={{ color: scoreColor1 }}>{totalA.toFixed(0)}</span>
                <span
                  style={{
                    margin: '0 28px',
                    fontStyle: 'italic',
                    color: 'rgba(244,237,224,0.35)',
                  }}
                >
                  —
                </span>
                <span style={{ color: scoreColor2 }}>{totalB.toFixed(0)}</span>
              </>
            ) : (
              <span style={{ fontStyle: 'italic', opacity: 0.6 }}>vs</span>
            )}
          </div>

          {/* Team 2 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'center',
              width: 370,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={team2Logo}
              alt=""
              width={140}
              height={140}
              style={{ objectFit: 'contain' }}
            />
            <div
              style={{
                fontSize: 56,
                fontWeight: 700,
                lineHeight: 1,
                marginTop: 18,
                textAlign: 'left',
                color: team2Won ? PAPER : isDraw ? PAPER : 'rgba(244,237,224,0.85)',
              }}
            >
              {team2Front}
              {team2Back ? (
                <span style={{ opacity: 0.7 }}> {team2Back}</span>
              ) : (
                ''
              )}
            </div>
            <div
              style={{
                marginTop: 14,
                fontSize: 18,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                fontWeight: 700,
                fontFamily: 'monospace',
                color: team2Won
                  ? ACCENT_BRIGHT
                  : isDraw
                  ? 'rgba(244,237,224,0.75)'
                  : MUTED,
              }}
            >
              {team2Won ? 'Winner' : team1Won ? 'Loser' : isDraw ? 'Draw' : ' '}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            color: MUTED,
            fontSize: 18,
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            fontWeight: 700,
            fontFamily: 'monospace',
            marginTop: 20,
          }}
        >
          TBL Stats · The Official Record · 2026
        </div>
      </div>
    ),
    { ...size },
  );
}
