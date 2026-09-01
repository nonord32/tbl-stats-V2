// src/app/stats/comebacks/page.tsx
// Public methodology for Comebacks & Blown Leads. Figures are computed from the
// live season so the page can't go stale.
import type { Metadata } from 'next';
import Link from 'next/link';
import { getComebackData, COMEBACK_THRESHOLD } from '@/lib/wpa';
import { getCityName } from '@/lib/teams';
import { SectionRule } from '@/components/chrome/SectionRule';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'How Comebacks Are Measured — TBL Methodology',
  description:
    'Every match has a moment where one team was closest to losing. We take the winner’s win probability at the end of every round and find the lowest it ever got.',
  openGraph: {
    url: 'https://tblstats.com/stats/comebacks',
    title: 'Comebacks & Blown Leads | TBL Stats',
    description: 'How close every winner came to losing, measured round by round.',
  },
};

const prose: React.CSSProperties = {
  fontFamily: 'var(--tbl-font-body)',
  fontSize: 15,
  lineHeight: 1.75,
  color: 'var(--tbl-ink)',
  margin: '0 0 14px',
};
const proseSmall: React.CSSProperties = { ...prose, fontSize: 13, color: 'var(--tbl-ink-soft)' };
const th: React.CSSProperties = {
  fontFamily: 'var(--tbl-font-mono)',
  fontSize: 10,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--tbl-ink-soft)',
  fontWeight: 700,
  padding: '6px 12px',
  borderBottom: '1.5px solid var(--tbl-ink)',
  textAlign: 'right',
};
const td: React.CSSProperties = {
  fontFamily: 'var(--tbl-font-mono)',
  fontSize: 12,
  padding: '7px 12px',
  borderBottom: '1px dotted rgba(20,17,11,0.3)',
  textAlign: 'right',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 30 }}>
      <SectionRule left={title} />
      {children}
    </section>
  );
}

export default async function ComebacksMethodologyPage() {
  const cb = await getComebackData();
  const t = cb.totals;
  const biggest = cb.matches[0];

  // Teams with the most blown leads from a commanding position, computed live.
  const bigLeadsBlown = [...cb.byTeam.values()]
    .filter((x) => x.blownLeads > 0)
    .sort((a, b) => b.blownLeads - a.blownLeads);
  const worst = bigLeadsBlown[0];
  const restCombined = bigLeadsBlown.slice(1).reduce((s, x) => s + x.blownLeads, 0);

  const dist: [string, number][] = [
    ['below 5%', t.below.p05],
    ['below 10%', t.below.p10],
    ['below 15%', t.below.p15],
    [`below ${(COMEBACK_THRESHOLD * 100).toFixed(0)}%`, t.below.p25],
    ['below 35%', t.below.p35],
  ];

  return (
    <div style={{ padding: '22px 32px 48px' }}>
      <div className="tbl-eyebrow">Methodology</div>
      <h1 className="tbl-display" style={{ fontSize: 54, lineHeight: 0.95, margin: '4px 0 0' }}>
        Comebacks &amp; Blown Leads
      </h1>

      <div style={{ maxWidth: 720 }}>
        <Section title="What It Measures">
          <p style={prose}>
            Every match has a moment where one team was closest to losing. We take the winner&apos;s
            win probability at the end of every round and find the lowest it ever got. That number
            is the comeback; the same number from the other side is the blown lead.
          </p>
          {biggest && (
            <p style={prose}>
              {getCityName(biggest.winnerTeam)} fell to{' '}
              <strong>{(biggest.comebackLow * 100).toFixed(1)}%</strong> against{' '}
              {getCityName(biggest.loserTeam)} on {biggest.date} — down{' '}
              {Math.abs(biggest.deficitAtLow)} after {biggest.lowRound} rounds — and won by{' '}
              {biggest.finalMargin}. That&apos;s the biggest comeback of the season.
              {biggest.footnote ? ' †' : ''}
            </p>
          )}
          <p style={proseSmall}>
            Only the states <em>after</em> each round count. The opening bell is always 50-50, so
            including it would floor every match at 50% and make wire-to-wire wins read as
            comebacks.{' '}
            <Link href="/comebacks" style={{ color: 'var(--tbl-accent)' }}>
              See the full ranking →
            </Link>
          </p>
        </Section>

        <Section title="Where the Bar Is">
          <p style={prose}>
            A team is credited with a comeback win when they were once below{' '}
            {(COMEBACK_THRESHOLD * 100).toFixed(0)}%. That happened{' '}
            <strong>{t.comebacks} times in {t.decidedMatches} matches</strong>.
          </p>
          <div style={{ overflowX: 'auto', margin: '4px 0 14px' }}>
            <table style={{ borderCollapse: 'collapse', minWidth: 340 }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'left' }}>Winner fell</th>
                  <th style={th}>Matches</th>
                </tr>
              </thead>
              <tbody>
                {dist.map(([label, n]) => (
                  <tr key={label}>
                    <td style={{ ...td, textAlign: 'left' }}>{label}</td>
                    <td style={{ ...td, fontWeight: 700 }}>
                      {n} of {t.decidedMatches}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={proseSmall}>
            The median low point for a winning team is{' '}
            <strong>{t.medianLow.toFixed(3)}</strong> — most winners are never in real danger.
            Draws are excluded: with no winner there is no comeback.
          </p>
        </Section>

        {worst && worst.blownLeads > 1 && (
          <Section title={`The ${getCityName(worst.team)} Problem`}>
            <p style={prose}>
              Worth calling out on its own. {getCityName(worst.team)} blew{' '}
              <strong>{worst.blownLeads} leads</strong>
              {worst.highestLeadBlown != null && (
                <> — the largest from {(worst.highestLeadBlown * 100).toFixed(1)}%</>
              )}
              {restCombined > 0 && worst.blownLeads > restCombined
                ? `, more than the rest of the league combined (${restCombined})`
                : ''}
              . No other team blew more than{' '}
              {bigLeadsBlown[1] ? bigLeadsBlown[1].blownLeads : 0}.
            </p>
          </Section>
        )}

        <Section title="What It Doesn't Measure">
          <p style={prose}>
            It&apos;s descriptive, not a skill. A team with comeback wins isn&apos;t better at
            comebacks — they&apos;re a team that fell behind and recovered, and{' '}
            <strong>falling behind isn&apos;t a virtue</strong>. Read the leaderboard as a record of
            what happened, not a ranking of grit.
          </p>
          <p style={proseSmall}>
            Built on the same win-probability model as{' '}
            <Link href="/stats/wpa" style={{ color: 'var(--tbl-accent)' }}>
              WPA
            </Link>{' '}
            — no separate model and no extra assumptions. Scheduled-round differences (two 2026
            matches ran 21 rounds instead of 24) are already baked into those probabilities.
          </p>
        </Section>

        {cb.matches.some((m) => m.footnote) && (
          <p
            style={{
              marginTop: 26,
              fontFamily: 'var(--tbl-font-mono)',
              fontSize: 10,
              lineHeight: 1.6,
              color: 'var(--tbl-ink-soft)',
            }}
          >
            {cb.matches
              .filter((m) => m.footnote)
              .map((m) => `† Match ${m.matchIndex}: ${m.footnote}`)
              .join('  ')}
          </p>
        )}
      </div>
    </div>
  );
}
