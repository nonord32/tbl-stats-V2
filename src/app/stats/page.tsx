// src/app/stats/page.tsx
//
// One page for every stat explanation, replacing six separate ones. Written
// for a boxing fan, not a statistician — each stat's formal spec stays tucked
// in its own collapsible block at the end of its section.
//
// The short definitions open the page on purpose. Nearly everyone who lands
// here saw one word in a table they didn't recognise and wants it answered in
// a few seconds; making them scroll past a methodology essay to get a one-line
// answer is backwards. The essays are still here, just second.
import type { Metadata } from 'next';
import Link from 'next/link';
import { SectionRule } from '@/components/chrome/SectionRule';
import { WpaSection } from './sections/WpaSection';
import { LeverageSection } from './sections/LeverageSection';
import { ComebacksSection } from './sections/ComebacksSection';
import { RatingsSection } from './sections/RatingsSection';
import { WarSection } from './sections/WarSection';
import { GlossarySection, TERMS } from './sections/GlossarySection';

// Four of the six merged pages read live season figures, so the page takes
// their revalidate window rather than the hourly one the two static explainers
// used to have.
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'How the Stats Work — Every TBL Stat Explained',
  description:
    'Plain-English definitions of every stat on TBL Stats, then how each one actually works: Win Probability Added, Stakes and Timing, Comebacks, Adjusted NPPR, Strength of Schedule and WAR.',
  openGraph: {
    url: 'https://tblstats.com/stats',
    title: 'How the Stats Work | TBL Stats',
    description: 'Every TBL stat, defined in plain English — then explained properly.',
  },
};

const JUMP: { id: string; label: string }[] = [
  { id: 'wpa', label: 'Win Probability' },
  { id: 'leverage', label: 'Stakes & Timing' },
  { id: 'comebacks', label: 'Comebacks' },
  { id: 'ratings', label: 'Adjusted Ratings' },
  { id: 'war', label: 'WAR' },
  { id: 'glossary', label: 'Full Glossary' },
];

export default function StatsPage() {
  // The advanced terms are what people arrive confused about; the basics sit
  // further down in the full glossary rather than pushing these off the screen.
  const advanced = TERMS.find((g) => g.section === 'Advanced')?.terms ?? [];

  return (
    <div style={{ padding: '22px 32px 48px' }}>
      <div className="tbl-eyebrow">Reference</div>
      <h1 className="tbl-display" style={{ fontSize: 54, lineHeight: 0.95, margin: '4px 0 0' }}>
        How the Stats Work
      </h1>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '16px 0 0' }}>
        {JUMP.map((j) => (
          <a
            key={j.id}
            href={`#${j.id}`}
            style={{
              fontFamily: 'var(--tbl-font-mono)',
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontWeight: 700,
              color: 'var(--tbl-accent)',
              border: '1.5px solid var(--tbl-accent)',
              padding: '5px 9px',
              textDecoration: 'none',
            }}
          >
            {j.label}
          </a>
        ))}
      </div>

      <div style={{ maxWidth: 720 }}>
        {/* ── The bit most people came for ── */}
        <section style={{ marginTop: 30 }}>
          <SectionRule left="Quick Definitions" right="Start here" />
          <p
            style={{
              fontFamily: 'var(--tbl-font-body)',
              fontSize: 15,
              lineHeight: 1.75,
              color: 'var(--tbl-ink-soft)',
              margin: '0 0 16px',
            }}
          >
            Saw a column you didn&apos;t recognise? Here they all are in a sentence each. The full
            explanation of any one of them is further down the page.
          </p>
          <dl style={{ margin: 0 }}>
            {advanced.map((t) => (
              <div
                key={t.name}
                style={{ borderBottom: '1px dotted rgba(20,17,11,0.3)', padding: '11px 0' }}
              >
                <dt
                  className="tbl-display"
                  style={{ fontSize: 18, fontWeight: 700, margin: '0 0 3px' }}
                >
                  {t.name}
                </dt>
                <dd
                  style={{
                    margin: 0,
                    fontFamily: 'var(--tbl-font-body)',
                    fontSize: 14.5,
                    lineHeight: 1.65,
                    color: 'var(--tbl-ink-soft)',
                  }}
                >
                  {t.def}
                </dd>
              </div>
            ))}
          </dl>
          <p
            style={{
              fontFamily: 'var(--tbl-font-mono)',
              fontSize: 11,
              lineHeight: 1.7,
              color: 'var(--tbl-ink-soft)',
              margin: '14px 0 0',
            }}
          >
            See them all in action on the{' '}
            <Link href="/advanced" style={{ color: 'var(--tbl-accent)' }}>
              advanced stats page
            </Link>
            , and on every fighter profile.
          </p>
        </section>
      </div>

      {/* ── Then the real explanations, one section per stat ── */}
      <div style={{ maxWidth: 720 }}>
        <WpaSection />
        <LeverageSection />
        <ComebacksSection />
        <RatingsSection />
        <WarSection />
        <GlossarySection />
      </div>
    </div>
  );
}
