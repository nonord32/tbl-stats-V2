// src/app/stats/comebacks/page.tsx
// Public methodology for Comebacks & Blown Leads. Figures are computed from the
// live season so the page can't go stale.
import Link from 'next/link';
import { getComebackData, COMEBACK_THRESHOLD } from '@/lib/wpa';
import { getCityName } from '@/lib/teams';
import {
  Block,
  StatSection,
  TechDetails,
  prose,
  proseSmall,
  monoTh,
  monoTd,
} from '../shared';


export async function ComebacksSection() {
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
    <StatSection id="comebacks" title="Comebacks &amp; Blown Leads" standfirst="How close the winner came to losing — and how close the loser came to winning.">

      <div style={{ maxWidth: 720 }}>
        <Block title="What It Measures">
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
            <Link href="/advanced?view=matches" style={{ color: 'var(--tbl-accent)' }}>
              See the full ranking →
            </Link>
          </p>
        </Block>

        <Block title="Where the Bar Is">
          <p style={prose}>
            A team is credited with a comeback win when they were once below{' '}
            {(COMEBACK_THRESHOLD * 100).toFixed(0)}%. That happened{' '}
            <strong>{t.comebacks} times in {t.decidedMatches} matches</strong>.
          </p>
          <div style={{ overflowX: 'auto', margin: '4px 0 14px' }}>
            <table style={{ borderCollapse: 'collapse', minWidth: 340 }}>
              <thead>
                <tr>
                  <th style={{ ...monoTh, textAlign: 'left' }}>Winner fell</th>
                  <th style={monoTh}>Matches</th>
                </tr>
              </thead>
              <tbody>
                {dist.map(([label, n]) => (
                  <tr key={label}>
                    <td style={{ ...monoTd, textAlign: 'left' }}>{label}</td>
                    <td style={{ ...monoTd, fontWeight: 700 }}>
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
        </Block>

        {worst && worst.blownLeads > 1 && (
          <Block title={`The ${getCityName(worst.team)} Problem`}>
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
          </Block>
        )}

        <Block title="What It Doesn't Measure">
          <p style={prose}>
            It&apos;s descriptive, not a skill. A team with comeback wins isn&apos;t better at
            comebacks — they&apos;re a team that fell behind and recovered, and{' '}
            <strong>falling behind isn&apos;t a virtue</strong>. Read the leaderboard as a record of
            what happened, not a ranking of grit.
          </p>
          <p style={proseSmall}>
            Built on the same win-probability model as{' '}
            <Link href="/stats#wpa" style={{ color: 'var(--tbl-accent)' }}>
              WPA
            </Link>{' '}
            — no separate model and no extra assumptions. Scheduled-round differences (two 2026
            matches ran 21 rounds instead of 24) are already baked into those probabilities.
          </p>
        </Block>

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
    </StatSection>
  );
}
