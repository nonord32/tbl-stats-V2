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
            How many wins a fighter added compared to the kind of fighter a team could easily
            find to replace them. Built from their scoring rate, how many rounds they fought, and
            what a win costs in points.{' '}
            <Link href="/stats/war" style={{ color: 'var(--tbl-accent)' }}>
              How WAR works →
            </Link>
          </>
        ),
      },
      {
        name: 'LI (Leverage Index)',
        def: (
          <>
            How much was riding on a round before it started. It belongs to the moment, not the
            fighter, so both fighters in a round have the same number. 1.00 is an ordinary round;
            6.63 is the maximum — a tied match with one round to go. A fighter&apos;s average tells
            you how big their moments were, not how they did in them.{' '}
            <Link href="/stats/leverage" style={{ color: 'var(--tbl-accent)' }}>
              How Leverage works →
            </Link>
          </>
        ),
      },
      {
        name: 'Clutch',
        def: (
          <>
            Whether a fighter&apos;s results came in the rounds that mattered. We compare what
            they actually did to what the same results would have been worth in ordinary rounds.
            Positive means their wins landed in the big moments. Disqualifications do not count.{' '}
            <Link href="/moments" style={{ color: 'var(--tbl-accent)' }}>
              Biggest moments →
            </Link>
          </>
        ),
      },
      {
        name: 'WPA (Win Probability Added)',
        def: (
          <>
            How much a round moved the team&apos;s chance of winning, credited to the fighter who
            caused it. A round won with the match on the line is worth far more than one won in a
            blowout.{' '}
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
      {
        name: 'SOS (Strength of Schedule)',
        def: (
          <>
            How good the opponents were that a fighter had to face. Above zero means a harder
            schedule than most. Rounds an opponent fought <em>against this fighter</em> are thrown
            out first — otherwise beating someone four times would drag their numbers down and make
            your own schedule look easy.{' '}
            <Link href="/stats/ratings" style={{ color: 'var(--tbl-accent)' }}>
              How it works →
            </Link>{' '}
            ·{' '}
            <Link href="/ratings" style={{ color: 'var(--tbl-accent)' }}>
              Leaderboard →
            </Link>
          </>
        ),
      },
      {
        name: 'aNPPR (Adjusted NPPR)',
        def: (
          <>
            Net points per round, once you account for who a fighter actually fought. Every
            fighter is rated against every other at the same time, across the whole season.
            Fighters with few rounds get pulled toward average on purpose. Each rating shows a
            range; gaps under 0.20 do not mean anything.{' '}
            <Link href="/stats/ratings" style={{ color: 'var(--tbl-accent)' }}>
              How it works →
            </Link>
          </>
        ),
      },
      {
        name: 'Comeback Win / Blown Lead',
        def: (
          <>
            The lowest the eventual winner&apos;s chances ever fell during a match. Dip under 25%
            and it counts as a comeback win — and, from the other side, a blown lead for the team
            that let it slip. Draws do not count.{' '}
            <Link href="/stats/comebacks" style={{ color: 'var(--tbl-accent)' }}>
              How it works →
            </Link>{' '}
            ·{' '}
            <Link href="/comebacks" style={{ color: 'var(--tbl-accent)' }}>
              Biggest comebacks →
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
