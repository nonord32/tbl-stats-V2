// src/app/awards/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllData, toSlug } from '@/lib/data';
import { getCityName, getTeamLogoPathByName } from '@/lib/teams';
import { DataUnavailable } from '@/components/DataUnavailable';
import type { AwardEntry } from '@/types';

export const metadata: Metadata = {
  title: 'Awards',
  description:
    'Team Boxing League season awards — MVP and more — with every past winner across TBL history.',
  openGraph: {
    url: 'https://tblstats.com/awards',
    title: 'TBL Awards — Season MVPs & Champions',
    description:
      'TBL season awards and historical winners, including MVP and category honors.',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TBL Awards',
    description: 'Every past TBL season award winner.',
    images: ['/og-image.png'],
  },
};

export const revalidate = 300;

const BASE = 'https://tblstats.com';

// Team awards (the winner is a team, not a fighter). Anything in this list
// renders with the city/team header treatment and skips the fighter link.
const TEAM_AWARDS = new Set(['Team Championship', 'Champion', 'Champions']);

// Awards whose `team` field is two teams (e.g. "Houston / San Antonio").
// Both logos render in the right-side chip.
const TWO_TEAM_AWARDS = new Set(['Fight of the Year']);

// Display order for award categories. Anything not in the list is appended
// after, alphabetically.
const AWARD_ORDER = [
  'Most Valuable Fighter',
  'Season MVP',
  'MVP',
  'Rookie of the Year',
  'Rising Star',
  'Most Entertaining Fighter',
  'Fight of the Year',
  'Female Fighter of the Year',
  'Team Championship',
];

function splitTeams(raw: string): string[] {
  return raw
    .split(/\s*(?:\/| vs\.? | & |,)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function AwardSection({
  award,
  entries,
  fighterSlugs,
}: {
  award: string;
  entries: AwardEntry[];
  fighterSlugs: Set<string>;
}) {
  const sorted = [...entries].sort((a, b) => b.season - a.season);
  const latestSeason = sorted[0]?.season;
  const isTeamAward = TEAM_AWARDS.has(award);

  return (
    <section style={{ marginBottom: 32 }}>
      <div
        style={{
          borderTop: '1.5px solid var(--tbl-ink)',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          padding: '14px 4px 12px',
          gap: 16,
        }}
      >
        <h2 className="tbl-display" style={{ fontSize: 22, margin: 0, lineHeight: 1 }}>
          {award}
        </h2>
        <span
          style={{
            fontFamily: 'var(--tbl-font-mono)',
            fontSize: 10,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--tbl-ink-soft)',
            fontWeight: 700,
          }}
        >
          {sorted.length} {sorted.length === 1 ? 'Season' : 'Seasons'}
        </span>
      </div>

      <div>
        {sorted.map((a) => {
          const isLatest = a.season === latestSeason;
          const slug = toSlug(a.winner);
          const linkable = !isTeamAward && fighterSlugs.has(slug);
          const isTwoTeam = TWO_TEAM_AWARDS.has(award);
          const teamList = isTwoTeam ? splitTeams(a.team) : [a.team];
          const primaryLogo = getTeamLogoPathByName(teamList[0] || a.team);
          const city = getCityName(a.team) || a.team;

          return (
            <div
              key={`${a.season}-${a.winner}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '72px 1fr auto',
                alignItems: 'center',
                gap: 16,
                padding: '14px 12px',
                background: isLatest ? 'rgba(20,17,11,0.04)' : 'transparent',
                borderBottom: '1px dotted rgba(20,17,11,0.18)',
              }}
            >
              {/* Season year */}
              <div
                className="tbl-mono"
                style={{
                  fontFamily: 'var(--tbl-font-mono)',
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: isLatest ? 'var(--tbl-accent)' : 'var(--tbl-ink-soft)',
                }}
              >
                {a.season}
              </div>

              {/* Winner + LATEST badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <span
                  className="tbl-display"
                  style={{
                    fontSize: 19,
                    fontWeight: isLatest ? 900 : 700,
                    color: isLatest ? 'var(--tbl-ink)' : 'var(--tbl-ink-soft)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {linkable ? (
                    <Link
                      href={`/fighters/${slug}`}
                      style={{ color: 'inherit', textDecoration: 'none' }}
                    >
                      {a.winner}
                    </Link>
                  ) : isTeamAward && primaryLogo ? (
                    <Link
                      href={`/teams/${toSlug(a.team)}`}
                      style={{ color: 'inherit', textDecoration: 'none' }}
                    >
                      {a.winner}
                    </Link>
                  ) : (
                    a.winner
                  )}
                </span>
              </div>

              {/* Team logo(s) + meta */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  fontFamily: 'var(--tbl-font-mono)',
                  fontSize: 12,
                  color: 'var(--tbl-ink-soft)',
                  whiteSpace: 'nowrap',
                }}
              >
                {isTwoTeam ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {teamList.map((t, i) => {
                      const tLogo = getTeamLogoPathByName(t);
                      const tCity = getCityName(t) || t;
                      return (
                        <span
                          key={`${t}-${i}`}
                          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                        >
                          {i > 0 && (
                            <span style={{ color: 'var(--tbl-ink-mute)', fontStyle: 'italic' }}>
                              vs
                            </span>
                          )}
                          <Link
                            href={`/teams/${toSlug(t)}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              color: 'var(--tbl-ink)',
                              textDecoration: 'none',
                              fontWeight: 700,
                            }}
                          >
                            {tLogo && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={tLogo}
                                alt=""
                                style={{ width: 20, height: 20, objectFit: 'contain' }}
                              />
                            )}
                            <span>{tCity}</span>
                          </Link>
                        </span>
                      );
                    })}
                  </div>
                ) : !isTeamAward ? (
                  <Link
                    href={`/teams/${toSlug(a.team)}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      color: 'var(--tbl-ink)',
                      textDecoration: 'none',
                      fontWeight: 700,
                    }}
                  >
                    {primaryLogo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={primaryLogo}
                        alt=""
                        style={{ width: 20, height: 20, objectFit: 'contain' }}
                      />
                    )}
                    <span>{city}</span>
                  </Link>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {primaryLogo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={primaryLogo}
                        alt=""
                        style={{ width: 20, height: 20, objectFit: 'contain' }}
                      />
                    )}
                    <span style={{ color: 'var(--tbl-ink)', fontWeight: 700 }}>{city}</span>
                  </span>
                )}
                {a.notes && <span>{a.notes}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default async function AwardsPage() {
  const data = await getAllData();
  const { awards, fighters } = data;
  const fighterSlugs = new Set(fighters.map((f) => f.slug));

  const byAward = new Map<string, AwardEntry[]>();
  for (const a of awards) {
    if (!byAward.has(a.award)) byAward.set(a.award, []);
    byAward.get(a.award)!.push(a);
  }

  const awardOrderIndex = (name: string) => {
    const idx = AWARD_ORDER.indexOf(name);
    return idx === -1 ? AWARD_ORDER.length : idx;
  };
  const awardGroups = [...byAward.entries()].sort(([a], [b]) => {
    const oa = awardOrderIndex(a);
    const ob = awardOrderIndex(b);
    if (oa !== ob) return oa - ob;
    return a.localeCompare(b);
  });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'TBL Stats', item: BASE },
          { '@type': 'ListItem', position: 2, name: 'Awards', item: `${BASE}/awards` },
        ],
      },
      {
        '@type': 'CollectionPage',
        '@id': `${BASE}/awards`,
        name: 'TBL Awards',
        description: 'TBL season awards and historical winners.',
        isPartOf: { '@id': `${BASE}/#website` },
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
            <h1>Awards</h1>
            <div className="subtitle">TBL Hall of Champions</div>
          </div>
          <p className="page-intro">
            Season honors awarded at the end of each TBL year. More categories
            coming as the league adds them.
          </p>

          {awardGroups.length === 0 ? (
            <DataUnavailable
              title="Awards are temporarily unavailable"
              description="We couldn't load awards from the source. Try again in a minute."
            />
          ) : (
            awardGroups.map(([award, entries]) => (
              <AwardSection
                key={award}
                award={award}
                entries={entries}
                fighterSlugs={fighterSlugs}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
