// src/app/fantasy/trades/page.tsx
// Inbox of incoming/outgoing trade offers + a stub composer.
import { TRADES, MY_LINEUP, MY_BENCH, STANDINGS } from '@/lib/fantasyMock';

export const dynamic = 'force-dynamic';

const ACTIVE = TRADES.filter((t) => t.status === 'pending');
const HISTORY = TRADES.filter((t) => t.status !== 'pending');

const MY_FIGHTER_NAMES = [
  ...MY_LINEUP.map((s) => s.fighter?.name).filter(Boolean),
  ...MY_BENCH.map((b) => b.fighter.name),
] as string[];

const OTHER_TEAMS = STANDINGS.filter((s) => !s.isYou).map((s) => s.team);

export default function FantasyTradesPage() {
  return (
    <>
      <div className="fantasy-hero fantasy-hero--compact">
        <div>
          <div className="tbl-eyebrow" style={{ color: 'var(--tbl-accent-bright)' }}>
            Trade Block
          </div>
          <div className="tbl-display fantasy-hero__title">Trades</div>
          <div className="fantasy-hero__sub">
            {ACTIVE.length} active offers · Trade deadline Sat 5/16
          </div>
        </div>
        <div className="fantasy-hero__stats">
          <div>
            <div className="fantasy-hero__stat-label">Incoming</div>
            <div className="tbl-display fantasy-hero__stat-value">
              {ACTIVE.filter((t) => t.direction === 'incoming').length}
            </div>
          </div>
          <div>
            <div className="fantasy-hero__stat-label">Outgoing</div>
            <div className="tbl-display fantasy-hero__stat-value">
              {ACTIVE.filter((t) => t.direction === 'outgoing').length}
            </div>
          </div>
        </div>
      </div>

      <div className="fantasy-body">
        {/* Active offers */}
        <section className="fantasy-section">
          <div className="tbl-section-rule">
            <span>Active Offers</span>
            <span>{ACTIVE.length} pending</span>
          </div>
          {ACTIVE.length === 0 ? (
            <div className="fantasy-empty">No active offers.</div>
          ) : (
            <div className="fantasy-trade-list">
              {ACTIVE.map((t) => (
                <div key={t.id} className="fantasy-trade-card">
                  <div className="fantasy-trade-card__head">
                    <span
                      className={`fantasy-trade-card__badge ${
                        t.direction === 'incoming'
                          ? 'is-incoming'
                          : 'is-outgoing'
                      }`}
                    >
                      {t.direction}
                    </span>
                    <div>
                      <div className="fantasy-trade-card__partner">
                        {t.partner}
                      </div>
                      <div className="fantasy-trade-card__owner">
                        @{t.partnerOwner} · sent {t.ageHours}h ago
                      </div>
                    </div>
                  </div>
                  <div className="fantasy-trade-card__bodies">
                    <div className="fantasy-trade-card__side">
                      <div className="fantasy-trade-card__side-label">You get</div>
                      <ul>
                        {t.youGet.map((f) => (
                          <li key={f.name}>
                            <span>{f.name}</span>
                            <span className="muted">{f.weightClass}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="fantasy-trade-card__arrow">⇄</div>
                    <div className="fantasy-trade-card__side">
                      <div className="fantasy-trade-card__side-label">They get</div>
                      <ul>
                        {t.theyGet.map((f) => (
                          <li key={f.name}>
                            <span>{f.name}</span>
                            <span className="muted">{f.weightClass}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="fantasy-trade-card__actions">
                    {t.direction === 'incoming' ? (
                      <>
                        <button
                          className="fantasy-btn fantasy-btn--primary"
                          type="button"
                        >
                          Accept
                        </button>
                        <button
                          className="fantasy-btn fantasy-btn--ghost"
                          type="button"
                        >
                          Counter
                        </button>
                        <button
                          className="fantasy-btn fantasy-btn--ghost"
                          type="button"
                          style={{ color: 'var(--tbl-red)', borderColor: 'var(--tbl-red)' }}
                        >
                          Decline
                        </button>
                      </>
                    ) : (
                      <button
                        className="fantasy-btn fantasy-btn--ghost"
                        type="button"
                      >
                        Cancel offer
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Composer */}
        <section className="fantasy-section">
          <div className="tbl-section-rule">
            <span>Propose a Trade</span>
            <span>Shopping for talent?</span>
          </div>
          <div className="fantasy-trade-compose">
            <div>
              <div className="fantasy-trade-compose__label">Send to team</div>
              <select className="fantasy-select">
                {OTHER_TEAMS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="fantasy-trade-compose__cols">
              <div>
                <div className="fantasy-trade-compose__label">You give up</div>
                <select className="fantasy-select" multiple size={6}>
                  {MY_FIGHTER_NAMES.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="fantasy-trade-compose__label">You receive</div>
                <select className="fantasy-select" multiple size={6}>
                  <option>Their fighters load when team is selected</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="fantasy-btn fantasy-btn--primary" type="button">
                Send offer
              </button>
            </div>
          </div>
        </section>

        {/* History */}
        <section className="fantasy-section">
          <div className="tbl-section-rule">
            <span>Trade History</span>
            <span>{HISTORY.length}</span>
          </div>
          <div className="fantasy-table-wrap">
            <table className="fantasy-table">
              <thead>
                <tr>
                  <th>Direction</th>
                  <th>Partner</th>
                  <th>You got</th>
                  <th>They got</th>
                  <th className="num">Status</th>
                </tr>
              </thead>
              <tbody>
                {HISTORY.map((t) => (
                  <tr key={t.id}>
                    <td className="muted">{t.direction}</td>
                    <td>
                      <span className="fantasy-table__team">{t.partner}</span>
                    </td>
                    <td className="muted">
                      {t.youGet.map((f) => f.name).join(', ')}
                    </td>
                    <td className="muted">
                      {t.theyGet.map((f) => f.name).join(', ')}
                    </td>
                    <td className="num mono" style={{ textTransform: 'capitalize' }}>
                      {t.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
