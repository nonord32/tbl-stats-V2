// src/app/fantasy/scoring/page.tsx
// Last event scoring breakdown for the user's lineup, head-to-head total
// vs their weekly opponent, and the rule chart.
import {
  SCORING_LAST,
  SCORING_OPP_TOTAL,
  SCORING_RULES,
  SLOT_LABELS,
  ME,
} from '@/lib/fantasyMock';

export const dynamic = 'force-dynamic';

const TOTAL = SCORING_LAST.reduce((sum, r) => sum + r.points, 0);
const OPP_TEAM = 'Headgear Heroes';
const OPP_OWNER = 'devon';
const RESULT: 'W' | 'L' | 'T' =
  TOTAL > SCORING_OPP_TOTAL ? 'W' : TOTAL < SCORING_OPP_TOTAL ? 'L' : 'T';

export default function FantasyScoringPage() {
  return (
    <>
      <div className="fantasy-hero fantasy-hero--scoring">
        <div className="fantasy-hero__sideline">
          <div className="tbl-eyebrow" style={{ color: 'var(--tbl-accent-bright)' }}>
            Final · Week 10
          </div>
          <div className="tbl-display fantasy-hero__title">{ME.team.name}</div>
          <div className="fantasy-hero__sub">
            {RESULT === 'W' ? 'Winner' : RESULT === 'L' ? 'Loser' : 'Tie'} · @
            {ME.user.handle}
          </div>
        </div>
        <div className="fantasy-hero__matchup">
          <div className="fantasy-hero__matchup-side">
            <div className="fantasy-hero__matchup-team">{ME.team.name}</div>
            <div
              className="tbl-display fantasy-hero__matchup-score"
              style={{
                color:
                  RESULT === 'W'
                    ? 'var(--tbl-accent-bright)'
                    : 'var(--tbl-bg)',
              }}
            >
              {TOTAL}
            </div>
          </div>
          <div className="fantasy-hero__matchup-dash">—</div>
          <div className="fantasy-hero__matchup-side">
            <div
              className="tbl-display fantasy-hero__matchup-score"
              style={{
                color:
                  RESULT === 'L'
                    ? 'var(--tbl-accent-bright)'
                    : 'var(--tbl-bg)',
              }}
            >
              {SCORING_OPP_TOTAL}
            </div>
            <div className="fantasy-hero__matchup-team">{OPP_TEAM}</div>
          </div>
        </div>
      </div>

      <div className="fantasy-body">
        {/* Bout-by-bout */}
        <section className="fantasy-section">
          <div className="tbl-section-rule">
            <span>Bout by Bout</span>
            <span>@{OPP_OWNER}</span>
          </div>
          <div className="fantasy-table-wrap">
            <table className="fantasy-table">
              <thead>
                <tr>
                  <th>Slot</th>
                  <th>Fighter</th>
                  <th>Bout</th>
                  <th>Result</th>
                  <th>Method</th>
                  <th className="num">Pts</th>
                </tr>
              </thead>
              <tbody>
                {SCORING_LAST.map((r) => (
                  <tr key={r.slot + r.fighter}>
                    <td className="muted" style={{ textTransform: 'uppercase' }}>
                      {SLOT_LABELS[r.slot]}
                    </td>
                    <td>
                      <span className="fantasy-table__team">{r.fighter}</span>
                    </td>
                    <td className="muted">{r.bout}</td>
                    <td>
                      <span
                        className="fantasy-result-badge"
                        style={{
                          background:
                            r.result === 'W'
                              ? 'var(--tbl-green)'
                              : 'var(--tbl-red)',
                        }}
                      >
                        {r.result}
                      </span>
                    </td>
                    <td className="muted">{r.method}</td>
                    <td
                      className="num mono"
                      style={{
                        fontWeight: 700,
                        color:
                          r.points > 0
                            ? 'var(--tbl-green)'
                            : r.points < 0
                            ? 'var(--tbl-red)'
                            : 'var(--tbl-ink-soft)',
                      }}
                    >
                      {r.points > 0 ? '+' : ''}
                      {r.points}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: 'var(--tbl-paper)' }}>
                  <td colSpan={5} style={{ fontWeight: 700, textAlign: 'right' }}>
                    Total
                  </td>
                  <td
                    className="num mono"
                    style={{
                      fontWeight: 900,
                      fontSize: 16,
                      color: 'var(--tbl-accent)',
                    }}
                  >
                    {TOTAL}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Scoring rules */}
        <section className="fantasy-section">
          <div className="tbl-section-rule">
            <span>Scoring Rules</span>
            <span>Per bout</span>
          </div>
          <div className="fantasy-rules-grid">
            {SCORING_RULES.map((r) => {
              const isPos = r.pts.startsWith('+');
              const isNeg = r.pts.startsWith('-');
              return (
                <div key={r.label} className="fantasy-rule-card">
                  <div className="fantasy-rule-card__label">{r.label}</div>
                  <div
                    className="tbl-display fantasy-rule-card__pts"
                    style={{
                      color: isPos
                        ? 'var(--tbl-green)'
                        : isNeg
                        ? 'var(--tbl-red)'
                        : 'var(--tbl-ink-soft)',
                    }}
                  >
                    {r.pts}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
