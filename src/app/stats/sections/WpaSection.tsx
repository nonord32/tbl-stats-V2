// src/app/stats/wpa/page.tsx
// Public methodology page for WPA (Win Probability Added). Written for a
// boxing fan, not a statistician — the formal spec lives in the collapsible
// "Technical details" section at the bottom. Linked from every WPA surface.
import Link from 'next/link';
import { WPA_TABLE, WPA_MODEL, WPA_MODEL_VERSION, wpLookup } from '@/lib/wpa';
import {
  Block,
  StatSection,
  TechDetails,
  prose,
  proseSmall,
  monoTh,
  monoTd,
} from '../shared';

// ── Local prose styling (gazette long-form) ──────────────────────────────────

const fmtWpa = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;

export function WpaSection() {
  const wp = (d: number, r: number) => wpLookup(WPA_TABLE, d, r);

  // "Same win, different value": a 1-point decision win, from a tie, at
  // different points in the match — computed live from the shipped table.
  const sameWinRows = [24, 20, 12, 8, 4, 1].map((remaining) => ({
    remaining,
    wpa: wp(1, remaining - 1) - wp(0, remaining),
  }));

  const calibration = [
    ['0–5%', 422, '0%'],
    ['5–15%', 165, '12.7%'],
    ['15–30%', 245, '24.9%'],
    ['30–45%', 313, '34.7%'],
    ['45–55%', 338, '50.0%'],
    ['55–70%', 313, '65.3%'],
    ['70–85%', 245, '75.1%'],
    ['85–95%', 165, '87.3%'],
    ['95–100%', 422, '100%'],
  ] as const;

  // WP grid for the technical section: realistic situations, full r range.
  const gridDs = Array.from({ length: 41 }, (_, i) => 20 - i); // +20 … −20
  const gridRs = Array.from({ length: 25 }, (_, i) => i); // 0 … 24

  return (
    <StatSection id="wpa" title="Win Probability Added" standfirst="Every round changes your team's chance of winning. WPA is that change, credited to the fighter who caused it.">

      <div style={{ maxWidth: 720 }}>
        <Block title="What WPA Measures">
          <p style={prose}>
            Every round changes your team&apos;s chance of winning the match. WPA — Win
            Probability Added — is that change, credited to the fighter who caused it. Win a
            round and your team&apos;s chances go up; you get that gain. Lose it and your
            opponent gets the gain while you get the equal-and-opposite loss.
          </p>
          <p style={prose}>
            The point of the stat is context. In the box score, a round won with the match on
            the line looks identical to one won in a blowout. WPA is the stat that knows the
            difference.
          </p>
          <p style={proseSmall}>
            See it in action on the{' '}
            <Link href="/advanced?view=fighters" style={{ color: 'var(--tbl-accent)' }}>
              advanced leaderboard
            </Link>
            , on every fighter profile, and round by round on every match page. Two stats
            build directly on this model:{' '}
            <Link href="/stats#leverage" style={{ color: 'var(--tbl-accent)' }}>
              Leverage Index and Clutch
            </Link>{' '}
            and{' '}
            <Link href="/stats#comebacks" style={{ color: 'var(--tbl-accent)' }}>
              Comebacks and Blown Leads
            </Link>
            .
          </p>
        </Block>

        <Block title="A Worked Example">
          <p style={prose}>
            Match 6, Phoenix vs Boston, round 16. Phoenix trailed by 2 points with 8 rounds
            left to fight. In that spot, teams win about <strong>25%</strong> of the time —
            they need to claw back two points against a team that only has to hold serve.
          </p>
          <p style={prose}>
            Manuel Villalobos then scored a TKO — worth 4 points. One round later Phoenix
            wasn&apos;t down 2; they were <em>up</em> 2 with 7 rounds left, a spot teams
            convert about <strong>75%</strong> of the time.
          </p>
          <p style={prose}>
            Before the round: 25% chance. After the round: 75% chance. Villalobos personally
            moved his team 50 percentage points toward a win. That&apos;s{' '}
            <strong>WPA +0.500</strong> — the biggest single round of the 2026 season. His
            opponent is charged the mirror image, −0.500.
          </p>
        </Block>

        <Block title="The Same Win Isn't Always Worth the Same">
          <p style={prose}>
            Take the most ordinary result there is: a 1-point decision win while the match is
            tied. Watch what it&apos;s worth as the match runs out of road:
          </p>
          <div style={{ overflowX: 'auto', margin: '6px 0 14px' }}>
            <table style={{ borderCollapse: 'collapse', minWidth: 360 }}>
              <thead>
                <tr>
                  <th style={{ ...monoTh, textAlign: 'left' }}>Situation (match tied)</th>
                  <th style={monoTh}>WPA for the win</th>
                </tr>
              </thead>
              <tbody>
                {sameWinRows.map((r) => (
                  <tr key={r.remaining}>
                    <td style={{ ...monoTd, textAlign: 'left' }}>
                      {r.remaining} round{r.remaining === 1 ? '' : 's'} left
                    </td>
                    <td
                      style={{
                        ...monoTd,
                        fontWeight: 700,
                        color: 'var(--tbl-green)',
                      }}
                    >
                      {fmtWpa(r.wpa)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={prose}>
            Same punch, same scorecard, wildly different stakes. Fans understand this
            intuitively from watching — a tied final round is everything, a tied 4th round is
            a skirmish. WPA just gives that intuition a number.
          </p>
        </Block>

        <Block title="Why Time Itself Matters">
          <p style={prose}>
            Holding a lead while rounds tick away raises your win probability even when the
            score doesn&apos;t move. Fewer remaining rounds means fewer chances for the
            trailing team to catch up — so the clock quietly works for whoever is ahead.
          </p>
          <p style={prose}>
            A real case: match 8, round 23. Philadelphia <em>lost</em> the round, but their
            win probability still went up — Las Vegas simply no longer had enough rounds left
            to close the gap. WPA reflects this: a round can carry value even at 0-0, and a
            lost round late can still be a &quot;good&quot; round for the team protecting a
            big lead. This is intended behavior, not a quirk.
          </p>
        </Block>

        <Block title="How Disqualifications Are Handled">
          <p style={prose}>
            Disqualification rounds are credited to <strong>neither fighter</strong>. Both
            fighters receive exactly zero WPA for a DQ round.
          </p>
          <p style={prose}>
            The reasoning: a disqualification is a referee&apos;s decision, not a boxing
            performance. Beyond that, the source data records only who was <em>awarded</em>{' '}
            the points — not who was disqualified. We can usually infer the offender from the
            scoring, but &quot;usually&quot; isn&apos;t a standard a public stat should rest
            on: a DQ can arise from an accidental foul, a cut, or a fighter unable to
            continue, and the data cannot distinguish those cases. Rather than credit or
            charge the wrong fighter, WPA attributes disqualification rounds to nobody.
          </p>
          <p style={prose}>
            The points still count. They&apos;re on the scoreboard, they shift the match
            differential, and they change every following round&apos;s win probability. Only
            the <em>credit</em> is withheld. This affects 8 rounds in the 2026 season. The
            largest came in match 13, where a DQ in the final round of a tied match decided
            it — worth 0.500 of win probability, now attributed to nobody.
          </p>
        </Block>

        <Block title="How the Model Was Built">
          <p style={prose}>
            The model uses exactly two inputs: the score differential and how many rounds are
            left. Nothing about who the fighters are.
          </p>
          <p style={prose}>
            That is deliberate. How good the fighters are, and how good their teams are, is left
            out entirely. WPA measures what happened to the team&apos;s chances — not how
            impressive it was against that particular opponent.
          </p>
          <p style={prose}>
            It was built from all 55 matches and 1,314 rounds of the 2026 season. And it
            balances exactly: setting aside disqualification rounds, every fighter on a
            winning team splits exactly +0.500 of WPA between them, and every fighter on a
            losing team splits −0.500. Nothing is invented and nothing goes missing.
          </p>
        </Block>

        <Block title="How Accurate Is It">
          <p style={prose}>
            Read this table as: &quot;when the model said 62%, teams actually won about 65% of
            the time.&quot; Across every round of the season, the model&apos;s stated chances
            track what actually happened:
          </p>
          <div style={{ overflowX: 'auto', margin: '6px 0 14px' }}>
            <table style={{ borderCollapse: 'collapse', minWidth: 380 }}>
              <thead>
                <tr>
                  <th style={{ ...monoTh, textAlign: 'left' }}>Model said</th>
                  <th style={monoTh}>Times</th>
                  <th style={monoTh}>Actually won</th>
                </tr>
              </thead>
              <tbody>
                {calibration.map(([band, times, won]) => (
                  <tr key={band}>
                    <td style={{ ...monoTd, textAlign: 'left' }}>{band}</td>
                    <td style={monoTd}>{times}</td>
                    <td style={{ ...monoTd, fontWeight: 700 }}>{won}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Block>

        <Block title="What WPA Does Not Do">
          <ul style={{ ...prose, paddingLeft: 22 }}>
            <li style={{ marginBottom: 8 }}>
              It does not account for opponent difficulty. Beating the best fighter in the
              league counts the same as beating the worst.
            </li>
            <li style={{ marginBottom: 8 }}>
              It is built on a single season of data. Expect refinements as more seasons
              accumulate.
            </li>
            <li style={{ marginBottom: 8 }}>
              Fighters with very few rounds can post extreme values. That&apos;s why the
              leaderboard defaults to a 10-round minimum.
            </li>
            <li style={{ marginBottom: 8 }}>
              It correlates about 0.78 with raw round win rate. WPA is round wins adjusted for
              when they happened — it is not a completely independent measure of skill.
            </li>
            <li>
              Disqualification rounds are attributed to nobody, so a small amount of win
              probability in a handful of matches is unassigned.
            </li>
          </ul>
        </Block>
      </div>

      {/* ── Technical details (collapsible) ────────────────────────────────── */}
      <TechDetails>
          <p style={proseSmall}>
            <strong>Two-stage model (version {WPA_MODEL_VERSION}, fit on the {WPA_MODEL.season} season).</strong>{' '}
            Stage 1: the per-round point margin follows a fixed empirical distribution
            (symmetrized so neither side has a built-in edge). The chance of winning from
            differential d with r rounds remaining is obtained by convolving that distribution
            r times, shifting by d, and taking P(final &gt; 0) + ½·P(final = 0) — the half
            credit because TBL matches can end in a draw. Stage 2: the baseline probability is
            sharpened through a logit transform with a single fitted parameter γ ={' '}
            {WPA_MODEL.gamma} — real TBL leads are more decisive than a pure random walk
            predicts, because teams that lead are often genuinely better. r = 0 is
            deterministic (1 / 0 / ½), never routed through the formula.
          </p>
          <p style={proseSmall}>
            <strong>Margin distribution</strong> (probability of each per-round point margin):
          </p>
          <div style={{ overflowX: 'auto', margin: '4px 0 14px' }}>
            <table style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...monoTh, textAlign: 'left' }}>Margin</th>
                  {Object.keys(WPA_MODEL.marginDistribution)
                    .map(Number)
                    .sort((a, b) => a - b)
                    .map((m) => (
                      <th key={m} style={monoTh}>
                        {m > 0 ? `+${m}` : m}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...monoTd, textAlign: 'left', fontWeight: 700 }}>P</td>
                  {Object.entries(WPA_MODEL.marginDistribution)
                    .map(([m, p]) => [Number(m), p] as const)
                    .sort((a, b) => a[0] - b[0])
                    .map(([m, p]) => (
                      <td key={m} style={monoTd}>
                        {p.toFixed(6)}
                      </td>
                    ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p style={proseSmall}>
            <strong>Per-round WPA.</strong> For a match with N scheduled rounds (24 for most
            2026 matches; matches 7 and 48 were 21), round t compares WP(diff after round t,
            N−t rounds left) against WP(diff after round t−1, N−t+1 left). The winning side&apos;s
            fighter is credited the change; the other fighter gets the exact negative.
          </p>
          <p style={proseSmall}>
            <strong>Rules.</strong> DQ rounds: zero credit to both fighters; points still count
            toward the differential (8 rounds in 2026). Match 14&apos;s round 25 was a
            post-match administrative award and is excluded entirely — WPA uses the
            competitive scoreboard (San Antonio 15-13) while the official result stands in the
            standings. Match 25 was an official draw; both teams&apos; WPA sums to 0.000.
            Rounds scored 0-0 still elapse and still move win probability for the leading
            team; one such round (match 25, round 19) has no fighter data and is assigned to
            no fighter.
          </p>
          <p style={proseSmall}>
            <strong>Validation.</strong> Before the DQ adjustment: every round is zero-sum
            between the teams; each match&apos;s round WPA telescopes to (outcome − ½) within
            1e-9; the season sums to 0.000; and the table satisfies WP(d,r) + WP(−d,r) = 1 for
            every cell. After the adjustment, all 8 DQ rounds carry exactly 0.0 on both sides.
            The shipped lookup table is verified against fixed checksums (e.g. WP(+1,1) =
            0.788514, WP(+7,2) = 0.999963) on every regeneration and in the test suite.
          </p>
          <p style={proseSmall}>
            <strong>Win probability grid</strong> — the team&apos;s chance of winning at score
            differential d (rows) with r rounds remaining (columns):
          </p>
          <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto', border: '1px solid rgba(20,17,11,0.25)' }}>
            <table style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...monoTh, position: 'sticky', top: 0, background: 'var(--tbl-bg)', textAlign: 'left' }}>
                    d \ r
                  </th>
                  {gridRs.map((r) => (
                    <th key={r} style={{ ...monoTh, position: 'sticky', top: 0, background: 'var(--tbl-bg)' }}>
                      {r}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gridDs.map((d) => (
                  <tr key={d}>
                    <td style={{ ...monoTd, textAlign: 'left', fontWeight: 700 }}>
                      {d > 0 ? `+${d}` : d}
                    </td>
                    {gridRs.map((r) => (
                      <td key={r} style={{ ...monoTd, padding: '4px 6px', fontSize: 10 }}>
                        {(wp(d, r) * 100).toFixed(1)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      </TechDetails>
    </StatSection>
  );
}
