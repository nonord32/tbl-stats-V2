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
              <strong>Points per win.</strong> How many net points it takes to buy one extra win.
              This is what turns a pile of points into a number of wins.
            </li>
          </ul>
          <p style={prose}>
            Put it together: take how far above the bar a fighter scores, multiply by how many
            rounds they fought, then convert that into wins. In formula form:{' '}
            <span style={{ fontFamily: 'var(--tbl-font-mono)', fontSize: 13 }}>
              WAR = (NP/R − Replacement NP/R) × Rounds ÷ Points Per Win
            </span>
            .
          </p>
        </Block>

        <Block title="Why Points Per Win Isn’t the Average Margin">
          <p style={prose}>
            The obvious answer to “how many points is a win worth?” is the average margin a match
            is won by — about {baseline.avgMargin.toFixed(1)} points this season. That answer is
            wrong, for two reasons.
          </p>
          <p style={prose}>
            <strong>Flipping a match takes twice the gap.</strong> If your team lost by 3, adding
            3 points gets you a draw, not a win. You need about 6 to come out the other side.
          </p>
          <p style={prose}>
            <strong>Most points don’t decide anything.</strong> Up by 15, an extra point is worth
            nothing. Down by 15, the same. Points only turn into wins in matches that are close,
            and a fighter’s season points land in blowouts as well as nail-biters — so the average
            point is worth far less than a point in a tight match.
          </p>
          <p style={prose}>
            So we use the answer our own win-probability model already gives. It puts the value of
            a one-point round at average stakes at{' '}
            <span style={{ fontFamily: 'var(--tbl-font-mono)' }}>0.062</span> of a win, which makes
            a win worth{' '}
            <span style={{ fontFamily: 'var(--tbl-font-mono)' }}>
              {baseline.pointsPerWin.toFixed(1)}
            </span>{' '}
            net points. That is the same number{' '}
            <Link href="/stats#wpa" style={{ color: 'var(--tbl-accent)' }}>
              Win Probability Added
            </Link>{' '}
            is built on, so a fighter’s WAR and their Win Impact are finally denominated in the
            same wins — and should land within a few tenths of each other, the gap being the
            replacement cushion.
          </p>
          <p style={proseSmall}>
            <strong>This changed during the 2026 season.</strong> WAR previously divided by the
            average match margin, which made every figure roughly three times larger than it
            should have been. If you have an older WAR number written down, it is not comparable
            to the one on this site now.
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
              { l: 'Points per win (the divisor)', v: baseline.pointsPerWin.toFixed(2) },
              { l: 'Average match margin (not the divisor)', v: baseline.avgMargin.toFixed(2) },
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
