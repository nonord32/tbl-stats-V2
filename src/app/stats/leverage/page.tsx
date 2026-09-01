// src/app/stats/leverage/page.tsx
// Public methodology for Leverage Index (LI) and Clutch. Fan-level language;
// the formal spec is collapsed at the bottom. Cross-linked with /stats/wpa,
// which covers the win-probability model both stats are built on.
import type { Metadata } from 'next';
import Link from 'next/link';
import { SectionRule } from '@/components/chrome/SectionRule';
import { LI_TABLE, WPA_MODEL, WPA_MODEL_VERSION, liLookup, getWpaData } from '@/lib/wpa';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'How Leverage & Clutch Work — TBL Methodology',
  description:
    'Leverage Index measures how much was at stake before a round. Clutch measures whether a fighter’s results came in the moments that mattered. How both are built, and what they can and cannot tell you.',
  openGraph: {
    url: 'https://tblstats.com/stats/leverage',
    title: 'How Leverage & Clutch Work | TBL Stats',
    description: 'Not every round matters equally. Leverage Index is the number that knows the difference.',
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

// Round-phase stats are COMPUTED from the live season rather than hardcoded, so
// the page stays correct whenever rounds are re-tagged between phases.
interface PhaseStat {
  phase: string;
  rounds: number;
  avg: number;
  median: number;
  max: number;
}
const PHASE_ORDER = ['launch', 'middle', 'money'];

export default async function LeverageMethodologyPage() {
  const li = (d: number, r: number) => liLookup(LI_TABLE, d, r);
  const season = await getWpaData();

  // Every competitive round's LI, grouped by the sheet's Round Phase.
  const allLi: number[] = [];
  const byPhase = new Map<string, number[]>();
  for (const m of season.byMatch.values()) {
    for (const r of m.rounds) {
      allLi.push(r.li);
      const key = (r.roundPhase ?? '').trim() || 'Unlabelled';
      if (!byPhase.has(key)) byPhase.set(key, []);
      byPhase.get(key)!.push(r.li);
    }
  }
  const median = (xs: number[]) => {
    if (xs.length === 0) return 0;
    const s = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };
  const phaseStats: PhaseStat[] = [...byPhase.entries()]
    .map(([phase, xs]) => ({
      phase,
      rounds: xs.length,
      avg: xs.reduce((a, b) => a + b, 0) / xs.length,
      median: median(xs),
      max: Math.max(...xs),
    }))
    .sort((a, b) => {
      const ia = PHASE_ORDER.indexOf(a.phase.toLowerCase());
      const ib = PHASE_ORDER.indexOf(b.phase.toLowerCase());
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      return a.phase.localeCompare(b.phase);
    });
  const moneyPhase = phaseStats.find((p) => p.phase.toLowerCase() === 'money');
  const pctBelow = allLi.length
    ? (allLi.filter((v) => v < 0.1).length / allLi.length) * 100
    : 0;
  const pctDouble = allLi.length
    ? (allLi.filter((v) => v > 2).length / allLi.length) * 100
    : 0;
  const equalPhases =
    phaseStats.length > 1 && new Set(phaseStats.map((p) => p.rounds)).size === 1;

  // The scale table, computed live from the shipped table.
  const scale: [string, number][] = [
    ['Tied, 1 round left', li(0, 1)],
    ['Tied, 2 rounds left', li(0, 2)],
    ['Tied, 4 rounds left', li(0, 4)],
    ['Tied, 12 rounds left', li(0, 12)],
    ['Tied, opening bell', li(0, 24)],
    ['Up 3, 12 rounds left', li(3, 12)],
    ['Up 5, 8 rounds left', li(5, 8)],
    ['Up 10, 8 rounds left', li(10, 8)],
    ['Up 15, 4 rounds left', li(15, 4)],
  ];

  return (
    <div style={{ padding: '22px 32px 48px' }}>
      <div className="tbl-eyebrow">Methodology · Model {WPA_MODEL_VERSION}</div>
      <h1 className="tbl-display" style={{ fontSize: 54, lineHeight: 0.95, margin: '4px 0 0' }}>
        Leverage &amp; Clutch
      </h1>

      <div style={{ maxWidth: 720 }}>
        <Section title="What Leverage Index Measures">
          <p style={prose}>
            Not every round matters equally. Leverage Index is how much win probability is on
            the table <em>before</em> a round starts — how big a swing the round is capable of
            producing, no matter who ends up winning it.
          </p>
          <p style={prose}>
            <strong>1.00 is an average TBL round.</strong> 2.00 means twice the normal stakes.
            0.10 means the round is nearly meaningless. The most important situation possible
            in TBL is a tied match with one round to go, at <strong>6.63</strong> — more than
            six times an average round.
          </p>
          <p style={prose}>
            LI belongs to the situation, not the fighter. Both fighters in a round face exactly
            the same leverage.
          </p>
          <p style={proseSmall}>
            See the highest-leverage rounds of the season on the{' '}
            <Link href="/moments" style={{ color: 'var(--tbl-accent)' }}>
              Biggest Moments
            </Link>{' '}
            board.
          </p>
        </Section>

        <Section title="The Scale">
          <div style={{ overflowX: 'auto', margin: '4px 0 14px' }}>
            <table style={{ borderCollapse: 'collapse', minWidth: 360 }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'left' }}>Situation</th>
                  <th style={th}>LI</th>
                </tr>
              </thead>
              <tbody>
                {scale.map(([label, value]) => (
                  <tr key={label}>
                    <td style={{ ...td, textAlign: 'left' }}>{label}</td>
                    <td
                      style={{
                        ...td,
                        fontWeight: 700,
                        color: value >= 2 ? 'var(--tbl-accent)' : 'var(--tbl-ink)',
                      }}
                    >
                      {value.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={prose}>
            Leverage climbs as rounds run out while the score stays close, and collapses toward
            zero once a lead is out of reach. Up 15 with 4 rounds left, the match is over in all
            but name — LI 0.00.
          </p>
        </Section>

        <Section title="The Money Round Finding">
          <p style={prose}>
            TBL matches run in three phases{equalPhases ? ' of equal length' : ''}. Sort every
            round by phase and something counterintuitive falls out:
          </p>
          {phaseStats.length > 0 ? (
            <>
              <div style={{ overflowX: 'auto', margin: '4px 0 14px' }}>
                <table style={{ borderCollapse: 'collapse', minWidth: 420 }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: 'left' }}>Phase</th>
                      <th style={th}>Rounds</th>
                      <th style={th}>Avg LI</th>
                      <th style={th}>Median LI</th>
                      <th style={th}>Max LI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {phaseStats.map((p) => {
                      const isMoney = p.phase.toLowerCase() === 'money';
                      return (
                        <tr key={p.phase}>
                          <td style={{ ...td, textAlign: 'left', fontWeight: isMoney ? 700 : 400 }}>
                            {p.phase}
                          </td>
                          <td style={td}>{p.rounds}</td>
                          <td style={td}>{p.avg.toFixed(2)}</td>
                          <td style={td}>{p.median.toFixed(2)}</td>
                          <td style={{ ...td, fontWeight: 700, color: isMoney ? 'var(--tbl-accent)' : 'inherit' }}>
                            {p.max.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {moneyPhase && (
                <p style={prose}>
                  Money rounds have the <em>lowest</em> average importance of any phase — and by
                  far the highest ceiling. The median Money round has an LI of just{' '}
                  <strong>{moneyPhase.median.toFixed(2)}</strong>, meaning the match is usually
                  already settled by the time it arrives. But every one of the most important
                  rounds in TBL history is a Money round.
                </p>
              )}
              <p style={prose}>
                <strong>
                  Money rounds aren&apos;t consistently big. They&apos;re either nothing or
                  everything.
                </strong>
              </p>
              <p style={prose}>
                Zoom out and the same pattern holds leaguewide:{' '}
                <strong>{pctBelow.toFixed(0)}% of all TBL rounds have an LI below 0.10</strong> —
                roughly one round in {Math.max(2, Math.round(100 / Math.max(pctBelow, 1)))} is
                competitively meaningless — while {pctDouble.toFixed(1)}% carry more than double
                average importance.
              </p>
            </>
          ) : (
            <p style={proseSmall}>Round-phase figures are unavailable right now.</p>
          )}
        </Section>

        <Section title="What Clutch Measures">
          <p style={prose}>
            Did a fighter&apos;s results come in the moments that mattered? Clutch takes what
            each round result would have been worth at <em>average</em> importance, and
            subtracts it from what the fighter actually produced.
          </p>
          <p style={prose}>
            Positive Clutch means a fighter&apos;s wins landed in bigger spots than their
            losses. Negative means they piled up round wins in garbage time and lost the ones
            that counted.
          </p>
          <p style={prose}>
            Take <strong>Money Powell</strong>: 19 rounds, 12 of them won — but an average
            leverage of 0.41, the lowest of any qualified fighter. His WPA is just +0.04. The
            same results at average leverage would have been worth +0.59. That&apos;s a Clutch
            of <strong>−0.55</strong>: he won plenty of rounds, but almost none of them
            mattered.
          </p>
          <p style={prose}>
            Contrast <strong>Erika Sanchez</strong>, whose +1.54 WPA comfortably exceeds her
            +1.09 context-neutral value — a Clutch of <strong>+0.45</strong>. Same league, same
            model, opposite story.
          </p>
          <p style={proseSmall}>
            Both are on the{' '}
            <Link href="/wpa" style={{ color: 'var(--tbl-accent)' }}>
              advanced leaderboard
            </Link>
            , sortable by Clutch and by average leverage.
          </p>
        </Section>

        <Section title="What These Stats Do Not Do">
          <ul style={{ ...prose, paddingLeft: 22 }}>
            <li style={{ marginBottom: 8 }}>
              <strong>LI is descriptive, not evaluative.</strong> A high average leverage means
              a fighter was <em>used</em> in big spots. It says nothing about whether they were
              good in them.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>Clutch over one season is noisy.</strong> In every sport that computes it,
              clutch performance has proven hard to sustain year over year. Treat it as a
              description of what happened, not a prediction of what comes next.
            </li>
            <li style={{ marginBottom: 8 }}>Neither adjusts for opponent quality.</li>
            <li>Disqualification rounds are excluded from both.</li>
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
            <strong>Leverage Index.</strong> Before a round, the state is a score differential{' '}
            <code>d</code> and rounds remaining <code>r</code> — where <code>r</code> INCLUDES
            the round about to be fought. Take every possible round outcome, weight each by how
            often it occurs, and average the absolute win-probability change:
            <br />
            <code>rawLI(d, r) = Σ over margins v of [ P(v) · |WP(d + v, r − 1) − WP(d, r)| ]</code>
            <br />
            <code>LI(d, r) = rawLI(d, r) / {WPA_MODEL.liNormalizer}</code>
            <br />
            <code>P(v)</code> is the same per-round margin distribution the win-probability
            model uses (see{' '}
            <Link href="/stats/wpa" style={{ color: 'var(--tbl-accent)' }}>
              How WPA Works
            </Link>
            ) — it is not redefined here.
          </p>
          <p style={proseSmall}>
            <strong>The normalizer is frozen.</strong> {WPA_MODEL.liNormalizer} is the mean
            rawLI across all 1,314 competitive rounds of 2026. It is deliberately never
            recomputed per season: if it were, an LI of 1.20 in 2026 and 1.20 in 2027 would mean
            different things and the stat would stop being comparable across years. LI is exactly
            symmetric — <code>LI(d, r) = LI(−d, r)</code> — because both teams face identical
            stakes; the shipped table is asserted against that on every regeneration.
          </p>
          <p style={proseSmall}>
            <strong>Clutch = WPA − cnWPA.</strong> Context-neutral WPA depends only on the
            round&apos;s point margin, derived as <code>(WP(v, 23) − 0.5) × {WPA_MODEL.cnScale}</code>{' '}
            — a tied match at the opening bell as the reference state, rescaled to exactly
            average leverage. Symmetric by construction: winning by 2 is worth exactly the
            negative of losing by 2.
          </p>
          <div style={{ overflowX: 'auto', margin: '4px 0 14px' }}>
            <table style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'left' }}>Round margin</th>
                  {Object.keys(WPA_MODEL.cnWpaByMargin)
                    .map(Number)
                    .sort((a, b) => a - b)
                    .map((m) => (
                      <th key={m} style={th}>
                        {m > 0 ? `+${m}` : m}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>cnWPA</td>
                  {Object.entries(WPA_MODEL.cnWpaByMargin)
                    .map(([m, v]) => [Number(m), v] as const)
                    .sort((a, b) => a[0] - b[0])
                    .map(([m, v]) => (
                      <td key={m} style={td}>
                        {v >= 0 ? '+' : ''}
                        {v.toFixed(6)}
                      </td>
                    ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p style={proseSmall}>
            <strong>Edge cases.</strong> Scheduled rounds vary by match (24 for most 2026
            matches; matches 7 and 48 were 21), and <code>r</code> is measured against that
            match&apos;s own count. <strong>Disqualification rounds are excluded from
            fighter-level LI and Clutch</strong> — they already produce zero WPA, so counting
            their leverage in the denominator would distort both stats; the round still carries
            an LI for display on the match page. This affects 8 rounds, so a fighter&apos;s LI
            round count can be lower than their WPA round count. Match 14&apos;s post-match
            round 25 is excluded entirely. Rounds scored 0-0 count normally: they carry real
            leverage and a small, real WPA. Leaguewide, Σ cnWPA and Σ Clutch are both 0.000.
          </p>
        </div>
      </details>
    </div>
  );
}
