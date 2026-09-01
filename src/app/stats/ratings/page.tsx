// src/app/stats/ratings/page.tsx
// How Strength of Schedule and Adjusted NPPR work. Written for a boxing fan,
// not a statistician — the formal spec lives in the collapsible "Technical
// details" section at the bottom. Live figures come from the season rather than
// being typed in, so the page cannot drift from the leaderboard.
import type { Metadata } from 'next';
import Link from 'next/link';
import { SectionRule } from '@/components/chrome/SectionRule';
import { getRatingsData, RATINGS_MODEL, RATINGS_MODEL_VERSION } from '@/lib/ratings';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'How Adjusted NPPR & Strength of Schedule Work',
  description:
    'Why beating the best fighter in the league should count for more than beating the worst — and how TBL Stats measures it, including how precise the numbers actually are.',
  openGraph: {
    url: 'https://tblstats.com/stats/ratings',
    title: 'How Adjusted Ratings Work | TBL Stats',
    description:
      'Strength of Schedule, Adjusted NPPR, and an honest account of how much of each number is signal.',
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

const monoTh: React.CSSProperties = {
  fontFamily: 'var(--tbl-font-mono)',
  fontSize: 10,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--tbl-ink-soft)',
  fontWeight: 700,
  padding: '6px 10px',
  borderBottom: '1.5px solid var(--tbl-ink)',
  textAlign: 'right',
};
const monoTd: React.CSSProperties = {
  fontFamily: 'var(--tbl-font-mono)',
  fontSize: 12,
  padding: '7px 10px',
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

const signed = (v: number, dp = 3) => `${v >= 0 ? '+' : ''}${v.toFixed(dp)}`;

export default async function RatingsMethodologyPage() {
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
    <div style={{ padding: '22px 32px 48px' }}>
      <div className="tbl-eyebrow">Methodology · Model {RATINGS_MODEL_VERSION}</div>
      <h1 className="tbl-display" style={{ fontSize: 54, lineHeight: 0.95, margin: '4px 0 0' }}>
        How Adjusted Ratings Work
      </h1>

      <div style={{ maxWidth: 720 }}>
        <Section title="The Problem">
          <p style={prose}>
            Every other rate stat on this site treats beating the best fighter in the league exactly
            the same as beating the worst. Net points per round counts what you did; it says nothing
            about who you did it against. Two fighters can post the same NPPR having faced entirely
            different opposition, and the box score will never tell you which one had the harder
            season.
          </p>
          <p style={prose}>
            These two stats fix that from opposite directions. <strong>Strength of Schedule</strong>{' '}
            describes who a fighter faced. <strong>Adjusted NPPR</strong> re-rates the fighter with
            that opposition already accounted for. They are computed independently, by different
            methods, and they answer different questions.
          </p>
          <p style={proseSmall}>
            See them live on the{' '}
            <Link href="/ratings" style={{ color: 'var(--tbl-accent)' }}>
              adjusted ratings leaderboard
            </Link>{' '}
            and on every fighter profile.
          </p>
        </Section>

        <Section title="What SOS Measures">
          <p style={prose}>
            The average quality of the opponents a fighter faced, measured by those opponents&apos;
            net points per round. Above zero means a harder-than-average schedule; below zero means
            an easier one. Opponents are weighted by how many rounds were actually fought against
            them, so the fighter you met four times counts four times as much as the one you met
            once.
          </p>
          {summary.toughest && summary.easiest && (
            <p style={prose}>
              In {RATINGS_MODEL_VERSION.slice(0, 4)}, the toughest schedule in the league belonged to{' '}
              <strong>{summary.toughest.name}</strong> at {signed(summary.toughest.sos)}, and the
              easiest to <strong>{summary.easiest.name}</strong> at {signed(summary.easiest.sos)} —
              a spread of {(summary.toughest.sos - summary.easiest.sos).toFixed(2)} points per round
              between the two ends of the same league.
            </p>
          )}
        </Section>

        <Section title="Why We Exclude Head-to-Head Rounds">
          <p style={prose}>
            This is the part that makes the stat honest, and it is worth explaining plainly.
          </p>
          <p style={prose}>
            If a fighter beats an opponent repeatedly, they push that opponent&apos;s numbers down.
            Do the naive thing — average your opponents&apos; NPPR as it stands — and your own
            beatings come back to make your schedule look weak. The better you are, the worse your
            schedule appears. The stat would be punishing fighters for winning.
          </p>
          <p style={prose}>
            So when we work out how good your opponent was, we remove{' '}
            <strong>every round they fought against you</strong> before computing their NPPR. We ask
            what they did against the rest of the league, and judge your schedule on that.
          </p>
          <p style={prose}>
            TBL&apos;s Launch / Middle / Money structure makes this unusually severe. About half of
            all fighter pairings repeat inside the same match, so opponents&apos; records are
            heavily composed of rounds against you. Here is what the three options do to the
            correlation between a fighter&apos;s own NPPR and their measured schedule strength —
            which should be near zero, since being good and having a hard schedule are unrelated:
          </p>
          <div style={{ overflowX: 'auto', margin: '6px 0 14px' }}>
            <table style={{ borderCollapse: 'collapse', minWidth: 360 }}>
              <thead>
                <tr>
                  <th style={{ ...monoTh, textAlign: 'left' }}>Method</th>
                  <th style={monoTh}>corr(NPPR, SOS)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...monoTd, textAlign: 'left' }}>Naive average opponent NPPR</td>
                  <td style={{ ...monoTd, color: 'var(--tbl-red)' }}>−0.569</td>
                </tr>
                <tr>
                  <td style={{ ...monoTd, textAlign: 'left' }}>Exclude one round</td>
                  <td style={{ ...monoTd, color: 'var(--tbl-red)' }}>−0.344</td>
                </tr>
                <tr>
                  <td style={{ ...monoTd, textAlign: 'left' }}>
                    <strong>Exclude all head-to-head rounds</strong>
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
            The bottom row is computed live from this season, not typed in. If it ever drifts back
            toward −0.5, the exclusion has broken.
          </p>
        </Section>

        <Section title="What aNPPR Measures">
          <p style={prose}>
            Adjusted NPPR takes a different route. Rather than rating fighters and then correcting
            for schedule, it solves for everyone at once. Every round is evidence about two fighters
            simultaneously — the margin tells you something about how good the winner is{' '}
            <em>and</em> how good the loser is. Ask which set of ratings best explains all{' '}
            {summary.pairedRounds.toLocaleString()} rounds of the season together, and that answer
            is aNPPR.
          </p>
          <p style={prose}>
            It reorders things at the margin rather than reshuffling them — aNPPR and raw NPPR
            correlate at {summary.corrNpprAnppr.toFixed(2)} across qualified fighters. The movers
            are the story.
          </p>
          {mover && (
            <p style={prose}>
              <strong>{mover.name}</strong> is the clearest case. On raw net points per round he
              reads as a losing fighter at {signed(mover.nppr)}. Account for who he was in the ring
              with and he sits at {signed(mover.anppr)} — near league average. The box score was
              describing his schedule, not him.
            </p>
          )}
        </Section>

        <Section title="How Precise It Is">
          <p style={prose}>
            Most sites publish a rating and let you assume it is exact. This one tells you how much
            of it is real.
          </p>
          <p style={prose}>
            We refit the whole model {RATINGS_MODEL.bootstrapSamples} times, each on a resampled
            version of the season, and watch how far each fighter&apos;s rating moves. The typical
            fighter&apos;s rating wobbles by about {summary.medianBootSd.toFixed(3)}, while the
            ratings themselves are spread {summary.ratingsStdDev.toFixed(3)} apart. That is a
            signal-to-noise ratio of roughly{' '}
            <strong>{summary.signalToNoise.toFixed(2)}</strong> — the ratings carry about twice as
            much signal as noise. Real, but not precise.
          </p>
          <p style={prose}>
            The practical rule, and we would rather state it than have you infer it:{' '}
            <strong>
              rating differences smaller than about {RATINGS_MODEL.meaningfulDiff.toFixed(2)} are
              not meaningful
            </strong>
            . A fighter three spots higher on the leaderboard is frequently not better. Where two
            fighters&apos; 90% ranges overlap, the ordering between them is close to arbitrary.
          </p>
          <p style={proseSmall}>
            Every rating on the site ships with that range. On the leaderboard a ⚠ marks any fighter
            whose spread exceeds {RATINGS_MODEL.flagBootSd.toFixed(2)}.
          </p>
        </Section>

        <Section title="Cross-Division Rankings">
          <p style={prose}>
            We publish a pound-for-pound leaderboard as well as per-division views, and the reason
            is worth stating because the intuition runs the other way.
          </p>
          <p style={prose}>
            Comparing fighters across weight classes rests on the fighters who changed class during
            the season — they are the links that tie the divisions to a common scale. That sounds
            fragile. But the bootstrap says cross-division ranks are the{' '}
            <em>more</em> stable ones: {summary.rankStabilityCross.toFixed(3)} pound-for-pound
            against {summary.rankStabilityWithin.toFixed(3)} within a weight class. Inside a
            division fighters sit closer together in quality, so a small perturbation reorders them
            more easily.
          </p>
          <p style={prose}>
            <strong>One caveat that we will not bury.</strong> The bootstrap measures sampling
            noise — it does not measure systematic bias. If the fighters who cross divisions are
            unrepresentative, say because fighters who move up in weight tend to be the better ones,
            that would shift a whole division&apos;s baseline and the bootstrap would never detect
            it. The cross-division numbers are usable and their uncertainty is quantified; the
            linkage assumption behind them is not testable with a single season of data.
          </p>
          {smallest && largest && smallest.weightClass !== largest.weightClass && (
            <p style={prose}>
              Division size matters too, which is why the division filter shows the qualified count
              for each. {largest.weightClass} has {largest.qualified} qualified fighters;{' '}
              {smallest.weightClass} has {smallest.qualified}. A division leader over a field of{' '}
              {smallest.qualified} should be read as exactly that.
            </p>
          )}
        </Section>

        <Section title="What These Stats Do Not Do">
          <ul style={{ ...prose, paddingLeft: 22 }}>
            <li style={{ marginBottom: 8 }}>
              <strong>They ignore when a round happened.</strong> A round won with the match on the
              line counts the same as one won in a blowout. That is what{' '}
              <Link href="/stats/leverage" style={{ color: 'var(--tbl-accent)' }}>
                Leverage and Clutch
              </Link>{' '}
              measure.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>aNPPR shrinks small samples toward league average on purpose.</strong> A
              fighter with 11 rounds will read closer to zero than their raw numbers suggest. That
              is the model declining to over-commit to thin evidence, not an error.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>SOS is a description, not a verdict.</strong> A hard schedule is not an
              achievement and an easy one is not a failing — it is mostly who the fixture list put
              in front of you.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>One season only.</strong> Ratings are fit on this season alone and carry
              nothing forward from any other.
            </li>
          </ul>
        </Section>
      </div>

      <details style={{ marginTop: 36, maxWidth: 860 }}>
        <summary
          style={{
            cursor: 'pointer',
            fontFamily: 'var(--tbl-font-mono)',
            fontSize: 11,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontWeight: 700,
            color: 'var(--tbl-accent)',
            padding: '10px 0',
            borderTop: '1.5px solid var(--tbl-ink)',
            borderBottom: '1.5px solid var(--tbl-ink)',
          }}
        >
          Technical Details — the formal spec
        </summary>
        <div style={{ paddingTop: 16 }}>
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
        </div>
      </details>
    </div>
  );
}
