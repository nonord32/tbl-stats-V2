// src/app/stats/war/page.tsx
// Public explainer for WAR (Wins Above Replacement) — plain language first,
// with the league constants computed live from the same data the site uses.
import Link from 'next/link';
import { getAllData, extractUniqueMatches } from '@/lib/data';
import { leagueBaseline } from '@/lib/warStats';
import {
  Block,
  StatSection,
  TechDetails,
  prose,
  proseSmall,
  monoTh,
  monoTd,
} from '../shared';


export async function WarSection() {
  const data = await getAllData();
  // The one league-wide baseline every WAR figure is measured against.
  const baseline = leagueBaseline(
    data.fighterHistory,
    extractUniqueMatches(data.teamMatches),
    'all',
  );

  return (
    <StatSection id="war" title="Wins Above Replacement" standfirst="How many wins a fighter added, compared to the kind of fighter a team could easily find to replace them.">

      <div style={{ maxWidth: 720 }}>
        <Block title="What WAR Measures">
          <p style={prose}>
            WAR asks a simple question: how many wins did this fighter add, compared to the
            kind of fighter a team could easily find to replace them?
            <br />
            <br />
            A WAR of 2.0 means their rounds were worth about two extra wins for the team. An
            easily-replaced fighter, in exactly those same rounds, would have delivered two
            fewer.
          </p>
          <p style={proseSmall}>
            WAR appears in the Advanced section of every{' '}
            <Link href="/fighters" style={{ color: 'var(--tbl-accent)' }}>
              fighter profile
            </Link>
            .
          </p>
        </Block>

        <Block title="How It's Computed">
          <p style={prose}>
            Three ingredients, all derived from the round-by-round results:
          </p>
          <ul style={{ ...prose, paddingLeft: 22 }}>
            <li style={{ marginBottom: 8 }}>
              <strong>Scoring rate.</strong> A fighter&apos;s net points per round (NP/R) —
              points scored minus points conceded, divided by rounds fought.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>The replacement bar.</strong> Line every fighter up by scoring rate and
              take the one a quarter of the way from the bottom. That is the bar. Score above it
              and you add value; below it and you cost your team.
            </li>
            <li>
              <strong>Points per win.</strong> The average margin a match is won by. This is what
              turns a pile of points into a number of wins.
            </li>
          </ul>
          <p style={prose}>
            Put it together: take how far above the bar a fighter scores, multiply by how many
            rounds they fought, then convert that into wins. In formula form:{' '}
            <span style={{ fontFamily: 'var(--tbl-font-mono)', fontSize: 13 }}>
              WAR = (NP/R − Replacement NP/R) × Rounds ÷ Avg Margin Per Match
            </span>
            .
          </p>
        </Block>

        <Block title="This Season's Constants">
          <p style={prose}>
            The same two numbers are used everywhere on the site. The yardstick does not change
            between the regular season and the playoffs — only a fighter&apos;s own scoring rate
            and round count do:
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
              { l: 'The replacement bar (NP/R)', v: baseline.replacementNppr.toFixed(3) },
              { l: 'Points per win (avg match margin)', v: baseline.avgMargin.toFixed(2) },
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
        </Block>

        <Block title="What WAR Does Not Do">
          <ul style={{ ...prose, paddingLeft: 22 }}>
            <li style={{ marginBottom: 8 }}>
              It doesn&apos;t know <em>when</em> points were scored. A garbage-time knockout
              counts the same as a match-winning one — that&apos;s what{' '}
              <Link href="/stats#wpa" style={{ color: 'var(--tbl-accent)' }}>
                WPA
              </Link>{' '}
              is for.
            </li>
            <li style={{ marginBottom: 8 }}>
              It doesn&apos;t adjust for opponent quality — beating the best fighter in the league
              counts the same as beating the worst. That&apos;s what{' '}
              <Link href="/stats#ratings" style={{ color: 'var(--tbl-accent)' }}>
                Adjusted NPPR and Strength of Schedule
              </Link>{' '}
              are for.
            </li>
            <li>
              Fighters with few rounds can post noisy values, up or down.
            </li>
          </ul>
        </Block>
      </div>
    </StatSection>
  );
}
