// src/app/stats/glossary/page.tsx
// Every stat on the site, defined in one place. Linked from the homepage
// Advanced Stats section.
import type { Metadata } from 'next';
import Link from 'next/link';
import { SectionRule } from '@/components/chrome/SectionRule';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Stat Glossary — Every TBL Stat Defined',
  description:
    'Definitions for every stat on TBL Stats: Record, Win%, Net Points, NP/R, Points For/Against, Extra Points, KO%, WAR, and WPA.',
  openGraph: {
    url: 'https://tblstats.com/stats/glossary',
    title: 'Stat Glossary | TBL Stats',
    description: 'Every TBL stat, defined.',
  },
};

interface Term {
  name: string;
  def: React.ReactNode;
}

const TERMS: { section: string; terms: Term[] }[] = [
  {
    section: 'The Basics',
    terms: [
      {
        name: 'Record',
        def: 'Rounds won and lost (W-L). Each round of a match is a bout between one fighter from each team; the round winner takes the W.',
      },
      {
        name: 'Win%',
        def: 'Round wins divided by decided rounds (wins + losses). Draws and disqualification rounds are not counted as wins or losses.',
      },
      {
        name: 'Rounds',
        def: 'Total rounds fought. Disqualification rounds are excluded from a fighter’s statkeeping.',
      },
      {
        name: 'Streak / Form',
        def: 'Consecutive results, most recent first — W3 means the last three rounds were wins.',
      },
    ],
  },
  {
    section: 'Scoring',
    terms: [
      {
        name: 'Round scoring',
        def: 'Winning a round earns points on a fixed scale: a Decision is worth 1 point, a Knockdown (KD) 2, a Double Knockdown (2x KD) 3, and a KO/TKO 4. The match is decided by total points, not round count.',
      },
      {
        name: 'Points For / Points Against',
        def: 'Total points a fighter scored across their rounds, and total points their opponents scored on them.',
      },
      {
        name: 'Net Points',
        def: 'Points For minus Points Against — a fighter’s total scoring margin.',
      },
      {
        name: 'NP/R (Net Points Per Round)',
        def: 'Net Points divided by rounds fought — the scoring-rate stat, comparable across fighters with different workloads.',
      },
      {
        name: 'Extra Points / Extra Points Allowed',
        def: 'Points above the 1-point decision baseline, by finish: Decision 0, KD +1, 2x KD +2, KO/TKO +3. Extra Points sums over rounds won; Extra Points Allowed over rounds lost — a measure of finishing power and finishing vulnerability.',
      },
    ],
  },
  {
    section: 'Finishing',
    terms: [
      {
        name: 'Knockdowns / Double KDs / KO-TKO',
        def: 'Counts of rounds won by each finishing method.',
      },
      {
        name: 'KO%',
        def: 'KO/TKO wins divided by total wins — the share of a fighter’s victories that came by stoppage.',
      },
    ],
  },
  {
    section: 'Advanced',
    terms: [
      {
        name: 'WAR (Wins Above Replacement)',
        def: (
          <>
            A fighter&apos;s total impact in team wins added over a replacement-level fighter,
            from their scoring rate, workload, and the league&apos;s points-per-win.{' '}
            <Link href="/stats/war" style={{ color: 'var(--tbl-accent)' }}>
              How WAR works →
            </Link>
          </>
        ),
      },
      {
        name: 'WPA (Win Probability Added)',
        def: (
          <>
            How much each round moved the team&apos;s chance of winning the match, credited to
            the fighter who caused it. A round won with the match on the line is worth far
            more than one won in a blowout.{' '}
            <Link href="/stats/wpa" style={{ color: 'var(--tbl-accent)' }}>
              How WPA works →
            </Link>{' '}
            ·{' '}
            <Link href="/wpa" style={{ color: 'var(--tbl-accent)' }}>
              Leaderboard →
            </Link>
          </>
        ),
      },
    ],
  },
];

export default function GlossaryPage() {
  return (
    <div style={{ padding: '22px 32px 48px' }}>
      <div className="tbl-eyebrow">Reference</div>
      <h1 className="tbl-display" style={{ fontSize: 54, lineHeight: 0.95, margin: '4px 0 0' }}>
        Stat Glossary
      </h1>

      <div style={{ maxWidth: 720 }}>
        {TERMS.map((group) => (
          <section key={group.section} style={{ marginTop: 30 }}>
            <SectionRule left={group.section} />
            <dl style={{ margin: 0 }}>
              {group.terms.map((t) => (
                <div
                  key={t.name}
                  style={{ padding: '10px 0', borderBottom: '1px dotted rgba(20,17,11,0.3)' }}
                >
                  <dt
                    className="tbl-display"
                    style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}
                  >
                    {t.name}
                  </dt>
                  <dd
                    style={{
                      margin: 0,
                      fontFamily: 'var(--tbl-font-body)',
                      fontSize: 14,
                      lineHeight: 1.7,
                      color: 'var(--tbl-ink-soft)',
                    }}
                  >
                    {t.def}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
