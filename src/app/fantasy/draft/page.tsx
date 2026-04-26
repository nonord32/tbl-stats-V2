// src/app/fantasy/draft/page.tsx
// Snake draft room. Available pool + recent picks come from real TBL
// fighter data via getFantasyData(); the snake order, draft state, and
// clock are mock since we have no real draft engine yet.
import { DRAFT_STATE, DRAFT_BOARD } from '@/lib/fantasyMock';
import { getFantasyData } from '@/lib/fantasyData';

export const dynamic = 'force-dynamic';

export default async function FantasyDraftPage() {
  const { draftAvailable, recentPicks } = await getFantasyData();
  const available = [...draftAvailable].sort((a, b) => b.projected - a.projected);
  const { round, pick, totalRounds, totalPicks, onTheClock, timer, isYourPick } =
    DRAFT_STATE;
  return (
    <>
      <div className="fantasy-hero fantasy-hero--compact">
        <div>
          <div
            className="tbl-eyebrow"
            style={{ color: isYourPick ? 'var(--tbl-accent-bright)' : 'rgba(244,237,224,0.6)' }}
          >
            {isYourPick ? 'You are on the clock' : `${onTheClock} on the clock`}
          </div>
          <div className="tbl-display fantasy-hero__title">
            Round {round} · Pick {pick}
          </div>
          <div className="fantasy-hero__sub">
            of {totalPicks} total · {totalRounds} rounds · Snake order
          </div>
        </div>
        <div className="fantasy-draft-clock">
          <div className="fantasy-draft-clock__label">Clock</div>
          <div className="tbl-display fantasy-draft-clock__time">{timer}</div>
        </div>
      </div>

      <div className="fantasy-body">
        {/* Snake board */}
        <section className="fantasy-section">
          <div className="tbl-section-rule">
            <span>Draft Order · Round {round}</span>
            <span>Snake</span>
          </div>
          <div className="fantasy-draft-board">
            {DRAFT_BOARD.map((team, i) => {
              const pickNumber = (round - 1) * DRAFT_BOARD.length + i + 1;
              const isPast = pickNumber < pick;
              const isNow = pickNumber === pick;
              return (
                <div
                  key={team}
                  className={`fantasy-draft-board__cell${
                    isNow ? ' is-now' : isPast ? ' is-past' : ''
                  }`}
                >
                  <div className="fantasy-draft-board__pick">#{pickNumber}</div>
                  <div className="fantasy-draft-board__team">{team}</div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="fantasy-draft-grid">
          {/* Available pool */}
          <section className="fantasy-section fantasy-draft-grid__main">
            <div className="tbl-section-rule">
              <span>Available · {available.length} fighters</span>
              <span>Sorted by Projected</span>
            </div>
            <div className="fantasy-draft-filters">
              <input
                className="fantasy-input"
                placeholder="Search fighter…"
                aria-label="Search fighter"
              />
              <select className="fantasy-select" aria-label="Filter weight class">
                <option>All weights</option>
                <option>Lightweight</option>
                <option>Welterweight</option>
                <option>Middleweight</option>
                <option>Heavyweight</option>
                <option>Female · Bantamweight</option>
                <option>Female · Featherweight</option>
                <option>Female · Super Lightweight</option>
              </select>
              <select className="fantasy-select" aria-label="Filter team">
                <option>All teams</option>
                <option>NYC Attitude</option>
                <option>Boston Butchers</option>
                <option>Atlanta Attack</option>
              </select>
            </div>
            <div className="fantasy-table-wrap">
              <table className="fantasy-table">
                <thead>
                  <tr>
                    <th>Fighter</th>
                    <th>Team</th>
                    <th>Class</th>
                    <th className="num">Proj</th>
                    <th className="num">Avg</th>
                    <th className="num">Own%</th>
                    <th className="num">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {available.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <span className="fantasy-table__team">{f.name}</span>
                      </td>
                      <td className="muted">{f.city}</td>
                      <td className="muted">{f.weightClass}</td>
                      <td className="num mono">{f.projected.toFixed(1)}</td>
                      <td className="num mono">{f.avg.toFixed(1)}</td>
                      <td className="num mono">{f.owned}%</td>
                      <td className="num">
                        <button
                          className="fantasy-btn fantasy-btn--primary fantasy-btn--small"
                          type="button"
                        >
                          Draft
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Pick log */}
          <aside className="fantasy-section fantasy-draft-grid__side">
            <div className="tbl-section-rule">
              <span>Recent Picks</span>
            </div>
            <div className="fantasy-pick-log">
              {recentPicks.map((p) => (
                <div key={`${p.round}-${p.pick}`} className="fantasy-pick-log__row">
                  <div className="fantasy-pick-log__num">
                    R{p.round}·#{p.pick}
                  </div>
                  <div>
                    <div className="fantasy-pick-log__name">{p.fighter}</div>
                    <div className="fantasy-pick-log__meta">
                      {p.team} · {p.weightClass}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
