// src/app/awards/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllData, toSlug } from '@/lib/data';
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
export const dynamic = 'force-dynamic';

const BASE = 'https://tblstats.com';

function AwardCard({
  award,
  entries,
  fighterSlugs,
}: {
  award: string;
  entries: AwardEntry[];
  fighterSlugs: Set<string>;
}) {
  const sorted = [...entries].sort((a, b) => b.season - a.season);
  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <span className="card-title">{award}</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 72 }}>Season</th>
              <th>Winner</th>
              <th>Team</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => {
              const slug = toSlug(a.winner);
              const linked = fighterSlugs.has(slug);
              return (
                <tr key={`${a.season}-${a.winner}`}>
                  <td className="mono">{a.season}</td>
                  <td>
                    {linked ? (
                      <Link
                        href={`/fighters/${slug}`}
                        style={{ color: 'var(--accent)', fontWeight: 600 }}
                      >
                        {a.winner}
                      </Link>
                    ) : (
                      <span style={{ fontWeight: 600 }}>{a.winner}</span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{a.team}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
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
  const awardGroups = [...byAward.entries()].sort(([a], [b]) => a.localeCompare(b));

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
              <AwardCard
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
