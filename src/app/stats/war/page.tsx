// src/app/stats/war/page.tsx
// Public explainer for WAR (Wins Above Replacement) — plain language first,
// with the league constants computed live from the same data the site uses.
import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllData, extractUniqueMatches } from '@/lib/data';
import { leagueBaseline } from '@/lib/warStats';
import { SectionRule } from '@/components/chrome/SectionRule';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'How WAR Works — Wins Above Replacement Methodology',
  description:
    'How TBL Stats computes Wins Above Replacement: a fighter’s total impact in team wins added over a replacement-level fighter, derived from net points per round and league-wide match margins.',
  openGraph: {
    url: 'https://tblstats.com/stats/war',
    title: 'How WAR Works | TBL Stats',
    description: 'Wins Above Replacement, explained for fight fans.',
  },
};

const prose: React.CSSProperties = {
  fontFamily: 'var(--tbl-font-body)',
  fontSize: 15,
  lineHeight: 1.75,
  color: 'var(--tbl-ink)',
  margin: '0 0 14px',
};
const proseSmall: React.CSSProperties = {
  ...prose,
  fontSize: 13,
  color: 'var(--tbl-ink-soft)',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 30 }}>
      <SectionRule left={title} />
      {children}
    </section>
  );
}

export default async function WarMethodologyPage() {
  const data = await getAllData();
  // The one league-wide baseline every WAR figure is measured against.
  const baseline = leagueBaseline(
    data.fighterHistory,
    extractUniqueMatches(data.teamMatches),
    'all',
  );

  return (
    <div style={{ padding: '22px 32px 48px' }}>
      <div className="tbl-eyebrow">Methodology</div>
      <h1 className="tbl-display" style={{ fontSize: 54, lineHeight: 0.95, margin: '4px 0 0' }}>
        How WAR Works
      </h1>

      <div style={{ maxWidth: 720 }}>
        <Section title="What WAR Measures">
          <p style={prose}>
            WAR — Wins Above Replacement — measures a fighter&apos;s total impact in terms of
            team wins added over a <em>replacement-level</em> fighter: the kind of fighter a
            team could plug in off the bench. A WAR of 2.0 means &quot;this fighter&apos;s
            rounds were worth about two more team wins than a replacement would have
            delivered in the same rounds.&quot;
          </p>
          <p style={proseSmall}>
            WAR appears in the Advanced section of every{' '}
            <Link href="/fighters" style={{ color: 'var(--tbl-accent)' }}>
              fighter profile
            </Link>
            .
          </p>
        </Section>

        <Section title="How It's Computed">
          <p style={prose}>
            Three ingredients, all derived from the round-by-round results:
          </p>
          <ul style={{ ...prose, paddingLeft: 22 }}>
            <li style={{ marginBottom: 8 }}>
              <strong>Scoring rate.</strong> A fighter&apos;s net points per round (NP/R) —
              points scored minus points conceded, divided by rounds fought.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>Replacement level.</strong> The 25th-percentile scoring rate across
              every fighter in the league. That&apos;s the bar: production above it adds
              value, production below it costs value.
            </li>
            <li>
              <strong>Points per win.</strong> The league-wide average margin of victory in a
              match. It converts a pile of net points into a number of team wins.
            </li>
          </ul>
          <p style={prose}>
            Put together: how far above (or below) replacement level a fighter scores, scaled
            by how many rounds they fought, converted into wins by the league&apos;s average
            match margin. In formula form:{' '}
            <span style={{ fontFamily: 'var(--tbl-font-mono)', fontSize: 13 }}>
              WAR = (NP/R − Replacement NP/R) × Rounds ÷ Avg Margin Per Match
            </span>
            .
          </p>
        </Section>

        <Section title="This Season's Constants">
          <p style={prose}>
            One whole-season baseline is used everywhere — the yardstick never changes
            between the regular season and the playoffs; only a fighter&apos;s own scoring
            rate and rounds do:
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              border: '1px solid rgba(20,17,11,0.25)',
              margin: '4px 0 14px',
            }}
          >
            {[
              { l: 'Replacement NP/R (25th percentile)', v: baseline.replacementNppr.toFixed(3) },
              { l: 'Avg Margin Per Match (points per win)', v: baseline.avgMargin.toFixed(2) },
            ].map((c) => (
              <div key={c.l} style={{ padding: '12px 14px', textAlign: 'center' }}>
                <div
                  style={{
                    fontFamily: 'var(--tbl-font-mono)',
                    fontSize: 9,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'var(--tbl-ink-soft)',
                    fontWeight: 700,
                  }}
                >
                  {c.l}
                </div>
                <div className="tbl-display" style={{ fontSize: 26, marginTop: 4 }}>
                  {c.v}
                </div>
              </div>
            ))}
          </div>
          <p style={proseSmall}>
            Both numbers are computed live from every decided match and every fighter&apos;s
            bout log — nothing is hand-entered. Disqualification rounds are excluded from
            fighter statkeeping (and therefore from WAR), though their points still count in
            match results.
          </p>
        </Section>

        <Section title="What WAR Does Not Do">
          <ul style={{ ...prose, paddingLeft: 22 }}>
            <li style={{ marginBottom: 8 }}>
              It doesn&apos;t know <em>when</em> points were scored. A garbage-time knockout
              counts the same as a match-winning one — that&apos;s what{' '}
              <Link href="/stats/wpa" style={{ color: 'var(--tbl-accent)' }}>
                WPA
              </Link>{' '}
              is for.
            </li>
            <li style={{ marginBottom: 8 }}>
              It doesn&apos;t adjust for opponent quality or weight class.
            </li>
            <li>
              Fighters with few rounds can post noisy values, up or down.
            </li>
          </ul>
        </Section>
      </div>
    </div>
  );
}
