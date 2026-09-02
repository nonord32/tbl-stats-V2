// src/app/stats/ratings/page.tsx
// How Strength of Schedule and Adjusted NPPR work. Written for a boxing fan,
// not a statistician — the formal spec lives in the collapsible "Technical
// details" section at the bottom. Live figures come from the season rather than
// being typed in, so the page cannot drift from the leaderboard.
import Link from 'next/link';
import { getRatingsData, RATINGS_MODEL, RATINGS_MODEL_VERSION } from '@/lib/ratings';
import {
  Block,
  StatSection,
  TechDetails,
  prose,
  proseSmall,
  monoTh,
  monoTd,
} from '../shared';


const signed = (v: number, dp = 3) => `${v >= 0 ? '+' : ''}${v.toFixed(dp)}`;

export async function RatingsSection() {
  const season = await getRatingsData();
  const { summary } = season;

  // The mover the copy leans on. Zaire Jefferson is the 2026 example; if a
  // future season lacks him, fall back to whoever the schedule moved most.
  const qualified = season.ranked.filter((f) => f.qualified);
  const named = qualified.find((f) => f.slug === 'zaire-jefferson');
  const mover =
    named ??
    [...qualified].sort((a, b) => b.delta - a.delta).find((f) => f.nppr < 0 && f.delta > 0) ??
    qualified[0];

  const divisionsWithField = season.divisions.filter((d) => d.qualified > 0);
  const smallest = [...divisionsWithField].sort((a, b) => a.qualified - b.qualified)[0];
  const largest = [...divisionsWithField].sort((a, b) => b.qualified - a.qualified)[0];

  return (
    <StatSection id="ratings" title="Adjusted NPPR &amp; Schedule" standfirst="Beating the best fighter in the league is harder than beating the worst. These two stats are the only ones here that know the difference.">

      <div style={{ maxWidth: 720 }}>
        <Block title="The Problem">
          <p style={prose}>
            Beating the best fighter in the league is harder than beating the worst. Every other
            stat on this site scores them the same.
          </p>
          <p style={prose}>
            Net points per round counts what you did. It says nothing about who you did it to. Two
            fighters can post the same number against completely different opposition, and the box
            score will never tell you which one had the harder season.
          </p>
          <p style={prose}>
            These two stats fix that from opposite ends.{' '}
            <strong>Strength of Schedule</strong> tells you who a fighter had to face.{' '}
            <strong>Adjusted NPPR</strong> re-scores the fighter with that already taken into
            account.
          </p>
          <p style={proseSmall}>
            See them live on the{' '}
            <Link href="/advanced?view=fighters&amp;stat=ratings" style={{ color: 'var(--tbl-accent)' }}>
              adjusted ratings leaderboard
            </Link>{' '}
            and on every fighter profile.
          </p>
        </Block>

        <Block title="Strength of Schedule: Who You Fought">
          <p style={prose}>
            Take everyone a fighter faced. Average how good they were, using their net points per
            round. That is the fighter&apos;s Strength of Schedule.
          </p>
          <p style={prose}>
            Above zero means a harder schedule than most. Below zero means an easier one. Opponents
            you met four times count four times as much as one you met once.
          </p>
          {summary.toughest && summary.easiest && (
            <p style={prose}>
              This season the hardest schedule went to <strong>{summary.toughest.name}</strong> at{' '}
              {signed(summary.toughest.sos)}. The easiest went to{' '}
              <strong>{summary.easiest.name}</strong> at {signed(summary.easiest.sos)}. That is a
              gap of {(summary.toughest.sos - summary.easiest.sos).toFixed(2)} points a round
              between two fighters in the same league.
            </p>
          )}
        </Block>

        <Block title="Why We Throw Out Your Own Rounds">
          <p style={prose}>
            This is the part that makes the number trustworthy, so it is worth spelling out.
          </p>
          <p style={prose}>
            Beat someone four times and you drag their numbers down. Now average your
            opponents&apos; numbers and your own beatings come back to bite you: your schedule looks
            weak <em>because</em> you were good. The better you fight, the easier your season would
            look.
          </p>
          <p style={prose}>
            So before we measure how good your opponent was, we throw out{' '}
            <strong>every round they fought against you</strong>. We only look at how they did
            against everybody else.
          </p>
          <p style={prose}>
            This matters more in TBL than in most leagues. About half of all match-ups repeat inside
            the same match, so a big chunk of your opponent&apos;s season is rounds against you.
          </p>
          <p style={prose}>
            Here is the proof it works. How good a fighter is should have nothing to do with how
            hard their schedule looks. So this number should sit at zero:
          </p>
          <div style={{ overflowX: 'auto', margin: '6px 0 14px' }}>
            <table style={{ borderCollapse: 'collapse', minWidth: 360 }}>
              <thead>
                <tr>
                  <th style={{ ...monoTh, textAlign: 'left' }}>How we measure the schedule</th>
                  <th style={monoTh}>How much the fighter&apos;s own skill leaks in</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...monoTd, textAlign: 'left' }}>Just average the opponents</td>
                  <td style={{ ...monoTd, color: 'var(--tbl-red)' }}>−0.569</td>
                </tr>
                <tr>
                  <td style={{ ...monoTd, textAlign: 'left' }}>Throw out one round</td>
                  <td style={{ ...monoTd, color: 'var(--tbl-red)' }}>−0.344</td>
                </tr>
                <tr>
                  <td style={{ ...monoTd, textAlign: 'left' }}>
                    <strong>Throw out every shared round</strong>
                  </td>
                  <td style={{ ...monoTd, fontWeight: 700, color: 'var(--tbl-green)' }}>
                    {summary.corrNpprSos >= 0 ? '+' : '−'}
                    {Math.abs(summary.corrNpprSos).toFixed(3)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p style={proseSmall}>
            Zero would be perfect. The bottom row is worked out live from this season, not typed in.
            If it ever slides back toward −0.5, something has broken.
          </p>
        </Block>

        <Block title="Adjusted NPPR: Rating Everyone At Once">
          <p style={prose}>
            Adjusted NPPR takes a different route. Instead of scoring fighters and then patching the
            result, it works out everybody&apos;s rating together.
          </p>
          <p style={prose}>
            Think of it this way. Every round tells you something about{' '}
            <em>both</em> fighters at the same time. Winning by three says you were good and says
            your opponent was not. Do that across all{' '}
            {summary.pairedRounds.toLocaleString()} rounds of the season at once, and you get one
            set of ratings that fits the whole year.
          </p>
          <p style={prose}>
            It does not blow up the leaderboard. Most fighters land close to where their raw numbers
            put them. The ones who move are the interesting part.
          </p>
          {mover && (
            <p style={prose}>
              <strong>{mover.name}</strong> is the clearest example. His raw net points per round is{' '}
              {signed(mover.nppr)}, which reads like a losing fighter. Account for who he was in
              there with and he sits at {signed(mover.anppr)} — right around league average. The box
              score was describing his schedule, not him.
            </p>
          )}
        </Block>

        <Block title="How Sure Are We?">
          <p style={prose}>
            Most sites give you a rating and let you assume it is exact. Here is how solid ours
            actually is.
          </p>
          <p style={prose}>
            We rebuilt the whole thing {RATINGS_MODEL.bootstrapSamples} times, each time on a
            slightly different version of the season, and watched how much each fighter&apos;s
            rating moved. A typical rating wobbles by about {summary.medianBootSd.toFixed(2)} either
            way. The ratings themselves are spread about {summary.ratingsStdDev.toFixed(2)} apart.
          </p>
          <p style={prose}>
            So there is roughly {summary.signalToNoise.toFixed(1)} times as much real signal as
            wobble. That is genuinely useful — but it is not precise, and we would rather say so.
          </p>
          <p style={prose}>
            The rule that follows:{' '}
            <strong>
              gaps smaller than about {RATINGS_MODEL.meaningfulDiff.toFixed(2)} do not mean anything
            </strong>
            . A fighter three spots up the leaderboard is often not actually better. Every rating on
            the site comes with a range; where two fighters&apos; ranges overlap, treat them as tied.
          </p>
          <p style={proseSmall}>
            On the leaderboard, a ⚠ marks any fighter whose rating wobbles more than{' '}
            {RATINGS_MODEL.flagBootSd.toFixed(2)} — those are the softest numbers on the page.
          </p>
        </Block>

        <Block title="Comparing Across Weight Classes">
          <p style={prose}>
            We publish a pound-for-pound list as well as one per division. That sounds like the
            shakier of the two, and we expected it to be. It is not.
          </p>
          <p style={prose}>
            Comparing across weight classes leans on the fighters who changed class during the
            season — they are what ties the divisions to a common scale. When we rebuilt the ratings
            over and over, though, the pound-for-pound order held up{' '}
            <em>better</em> than the within-division order: {summary.rankStabilityCross.toFixed(2)}{' '}
            against {summary.rankStabilityWithin.toFixed(2)}, where 1.00 means it never moved.
          </p>
          <p style={prose}>
            The reason is simple. Fighters inside one division are closer in quality, so it takes
            less to flip two of them.
          </p>
          <p style={prose}>
            <strong>One warning we are not going to bury.</strong> Rebuilding the season over and
            over catches random luck. It does not catch a whole division being mis-set. If fighters
            who move up in weight tend to be the better ones, an entire division could sit too high
            or too low and none of our checks would notice. One season of data cannot settle that.
          </p>
          {smallest && largest && smallest.weightClass !== largest.weightClass && (
            <p style={prose}>
              Field size matters too, which is why the division menu shows how many fighters
              qualified. {largest.weightClass} has {largest.qualified}. {smallest.weightClass} has{' '}
              {smallest.qualified}. Leading a field of {smallest.qualified} should be read as
              exactly that.
            </p>
          )}
        </Block>

        <Block title="What These Stats Do Not Do">
          <ul style={{ ...prose, paddingLeft: 22 }}>
            <li style={{ marginBottom: 8 }}>
              <strong>They ignore when a round happened.</strong> A round won with the match on the
              line counts the same as one won in a blowout. That is what{' '}
              <Link href="/stats#leverage" style={{ color: 'var(--tbl-accent)' }}>
                Leverage and Clutch
              </Link>{' '}
              are for.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>They pull thin records toward the middle on purpose.</strong> A fighter with
              11 rounds will read closer to average than their raw numbers suggest. With that little
              evidence, we would rather under-claim than over-claim.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>A hard schedule is not an achievement.</strong> Strength of Schedule describes
              what happened to a fighter, not how good they are. Mostly it is just who the fixture
              list put in front of them.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>This season only.</strong> Nothing carries over from any other year.
            </li>
          </ul>
        </Block>
      </div>

      <TechDetails>
          <p style={proseSmall}>
            <strong>Strength of Schedule.</strong> For fighter A, over each opponent X faced k
            times:
            <br />
            <code>
              X_nppr_excl_A = (X&apos;s total net points − X&apos;s net points in rounds vs A) ÷
              (X&apos;s total rounds − k)
            </code>
            <br />
            <code>SOS(A) = Σ k · X_nppr_excl_A ÷ Σ k</code>
            <br />
            An opponent whose round count falls to zero after exclusion is dropped from both the
            numerator and the weight total. Totals are the published NPPR numerator and denominator,
            so the stat is defined against the NPPR readers actually see.
          </p>
          <p style={proseSmall}>
            <strong>Adjusted NPPR.</strong> Ridge regression over every round with both fighters
            identified:
            <br />
            <code>net points in the round = (fighter&apos;s rating) − (opponent&apos;s rating) + error</code>
            <br />
            <code>theta = solve(XᵀX + λI, Xᵀy)</code> with <strong>λ = {RATINGS_MODEL.lambda}</strong>.
            X carries one row per round — not one per fighter-round; duplicating each round from
            both perspectives would double-count every observation and push the penalty tuning to a
            degenerate value — with +1 in the fighter&apos;s column, −1 in the opponent&apos;s, and
            y the margin from the first fighter&apos;s side. Row orientation is irrelevant: flipping
            a row negates both the ±1 pattern and y, leaving XᵀX and Xᵀy unchanged.
          </p>
          <p style={proseSmall}>
            <strong>On λ = {RATINGS_MODEL.lambda}.</strong> {RATINGS_MODEL.lambdaNote}
          </p>
          <p style={proseSmall}>
            <strong>Solver.</strong> XᵀX + λI is a graph Laplacian plus λI — sparse, and strictly
            positive definite for λ &gt; 0. It is solved by conjugate gradient without ever forming
            the matrix: each product costs one pass over the round list. The point solve converged
            in {season.validation.solveIterations} iterations this season. A dense Cholesky
            factorization is kept as an independent cross-check in the unit tests.
          </p>
          <p style={proseSmall}>
            <strong>Uncertainty.</strong> {RATINGS_MODEL.bootstrapSamples} refits, resampling rounds
            with replacement, reported as a standard deviation and a{' '}
            {Math.round((RATINGS_MODEL.intervalHigh - RATINGS_MODEL.intervalLow) * 100)}% interval.
            The resampler is seeded ({RATINGS_MODEL.bootstrapSeed}) — ratings are recomputed on
            every cache revalidation, and an unseeded bootstrap would make every published interval
            flicker between page loads. Rank stability is the mean Spearman correlation between the
            point-estimate ranking and each refit&apos;s ranking; the within-division figure averages
            over divisions with at least five qualified fighters.
          </p>
          <p style={proseSmall}>
            <strong>Round universe.</strong> {RATINGS_MODEL.roundUniverseNote} This season:{' '}
            {summary.pairedRounds.toLocaleString()} paired rounds across {summary.fighters} fighters,{' '}
            {summary.qualifiedFighters} of them qualified at {RATINGS_MODEL.minRounds}+ rounds.
          </p>
          <p style={proseSmall}>
            <strong>Why SOS is not aNPPR − NPPR.</strong> {RATINGS_MODEL.sosIndependenceNote}
          </p>
          <p style={proseSmall}>
            <strong>Validation.</strong> The pure functions are unit-tested against synthetic
            leagues (CG against Cholesky, orientation invariance, shrinkage ordering, the
            head-to-head exclusion firing, bootstrap determinism). The season figures — every
            reference fighter&apos;s SOS and aNPPR, the correlation bound above, the paired-round
            count — are asserted against live data by the admin validation route. Point estimates
            are exactly reproducible; bootstrap spreads are stochastic and checked as ranges.
          </p>
      </TechDetails>
    </StatSection>
  );
}
