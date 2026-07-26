// src/app/matches/[matchIndex]/opengraph-image.tsx
// Dynamic Open Graph card for /matches/<id> — shared on iMessage / Twitter /
// Discord it renders the actual teams, score, week, and date over the site's
// dark gazette match-hero band. Keeps the dual-team scoreboard layout but now
// uses the shared TBL palette + fonts + corner branding.
import { ImageResponse } from 'next/og';
import { getMatchByIndex, toSlug } from '@/lib/data';
import { getFullTeamName, getTeamLogoPathByName } from '@/lib/teams';
import {
  OG_SIZE,
  OG_CONTENT_TYPE,
  INK,
  CREAM,
  ACCENT,
  MUTED,
  FAINT,
  splitName,
  loadOgFonts,
  ogLogoUrl,
} from '@/app/_og/card';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'TBL Stats — Match Box Score';

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

export default async function MatchOG({ params }: { params: { matchIndex: string } }) {
  const fonts = loadOgFonts();
  const mi = parseInt(params.matchIndex, 10);
  const result = isNaN(mi) ? null : await getMatchByIndex(mi);

  // Fallback card keeps social previews from breaking on a bad URL.
  if (!result) {
    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            background: INK,
            color: CREAM,
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Playfair',
            fontWeight: 900,
            fontSize: 96,
            letterSpacing: '-0.02em',
          }}
        >
          TBL Stats
        </div>
      ),
      { ...OG_SIZE, fonts },
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
  const eyebrow = [
    status,
    scheduleEntry?.week ? `Week ${scheduleEntry.week}` : null,
    formatDate(match.date),
    scheduleEntry?.venueName
      ? `${scheduleEntry.venueName}${scheduleEntry.venueCity ? ` · ${scheduleEntry.venueCity}` : ''}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ')
    .toUpperCase();

  // True-PNG logos (the /logos/*.png files are actually WebP, which Satori drops).
  const team1Logo = ogLogoUrl(getTeamLogoPathByName(match.team1));
  const team2Logo = ogLogoUrl(getTeamLogoPathByName(match.team2));

  const scoreColor1 = team1Won ? ACCENT : CREAM;
  const scoreColor2 = team2Won ? ACCENT : CREAM;

  const teamColumn = (
    logo: string,
    front: string,
    back: string,
    won: boolean,
    resultLabel: string,
    align: 'flex-start' | 'flex-end',
  ) => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: align,
        justifyContent: 'center',
        width: 360,
      }}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" width={132} height={132} style={{ objectFit: 'contain' }} />
      ) : null}
      <div
        style={{
          display: 'flex',
          fontFamily: 'Playfair',
          fontWeight: 900,
          fontSize: 52,
          lineHeight: 0.96,
          letterSpacing: '-0.02em',
          marginTop: 18,
          textAlign: align === 'flex-end' ? 'right' : 'left',
          color: won || isDraw ? CREAM : FAINT,
        }}
      >
        {front}
        {back ? <span style={{ opacity: 0.65 }}>&nbsp;{back}</span> : null}
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: 14,
          fontFamily: 'PlexMono',
          fontWeight: 700,
          fontSize: 18,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: won ? ACCENT : isDraw ? FAINT : MUTED,
        }}
      >
        {resultLabel}
      </div>
    </div>
  );

  const label1 = team1Won ? 'Winner' : team2Won ? 'Loser' : isDraw ? 'Draw' : ' ';
  const label2 = team2Won ? 'Winner' : team1Won ? 'Loser' : isDraw ? 'Draw' : ' ';

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: INK,
          color: CREAM,
          padding: '56px 72px',
          justifyContent: 'space-between',
          fontFamily: 'Playfair',
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            fontFamily: 'PlexMono',
            fontWeight: 700,
            fontSize: 22,
            letterSpacing: '0.26em',
            textTransform: 'uppercase',
            color: ACCENT,
          }}
        >
          {eyebrow}
        </div>

        {/* Team 1 · score · Team 2 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {teamColumn(team1Logo, team1Front, team1Back, team1Won, label1, 'flex-end')}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Playfair',
              fontWeight: 900,
              fontSize: 168,
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
          >
            {hasScore ? (
              <>
                <span style={{ color: scoreColor1 }}>{totalA.toFixed(0)}</span>
                <span style={{ margin: '0 26px', color: 'rgba(244,237,224,0.35)' }}>–</span>
                <span style={{ color: scoreColor2 }}>{totalB.toFixed(0)}</span>
              </>
            ) : (
              <span style={{ fontStyle: 'italic', opacity: 0.6, fontSize: 96 }}>vs</span>
            )}
          </div>
          {teamColumn(team2Logo, team2Front, team2Back, team2Won, label2, 'flex-start')}
        </div>

        {/* Footer: branding in the corner */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div
            style={{
              display: 'flex',
              fontFamily: 'PlexMono',
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: MUTED,
            }}
          >
            Team Boxing League
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <div style={{ fontFamily: 'Playfair', fontWeight: 900, fontSize: 34, color: CREAM }}>
              tblstats.com
            </div>
            <div
              style={{
                fontFamily: 'PlexMono',
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: MUTED,
              }}
            >
              The Official Record · 2026
            </div>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
