// src/app/fantasy/trades/page.tsx
// v2 redesign — trade inbox, composer, history. Trade-offer structure
// is mock until Stage 4 (real trades) ships, but fighter names on each
// side come from real TBL data via getFantasyData() so the offers
// reflect the actual roster you'd own.
import { STANDINGS } from '@/lib/fantasyMock';
import { getFantasyData } from '@/lib/fantasyData';

export const dynamic = 'force-dynamic';

const OTHER_TEAMS = STANDINGS.filter((s) => !s.isYou).map((s) => s.team);

export default async function FantasyTradesPage() {
  const { lineup, bench, trades } = await getFantasyData();
  const ACTIVE = trades.filter((t) => t.status === 'pending');
  const HISTORY = trades.filter((t) => t.status !== 'pending');

  const MY_FIGHTER_NAMES = [
    ...(lineup.map((s) => s.fighter?.name).filter(Boolean) as string[]),
    ...bench.map((b) => b.fighter.name),
  ];

  const incoming = ACTIVE.filter((t) => t.direction === 'incoming').length;
  const outgoing = ACTIVE.filter((t) => t.direction === 'outgoing').length;

  return (
    <div className="fv2-body">
      {/* Hero */}
      <section className="fv2-hero">
        <div className="fv2-hero__eyebrow">Trade Block · Mock</div>
        <div className="fv2-hero__title">Trades</div>
        <div className="fv2-hero__sub">
          {ACTIVE.length} active offers · Trade deadline <strong>Sat 5/16</strong>
        </div>
      </section>

      {/* Stat strip */}
      <section className="fv2-section">
        <div className="fv2-stat-grid">
          <div className="fv2-stat">
            <div className="fv2-stat__label">Incoming</div>
            <div className="fv2-stat__value fv2-stat__value--accent">{incoming}</div>
            <div className="fv2-stat__hint">awaiting your reply</div>
          </div>
          <div className="fv2-stat">
            <div className="fv2-stat__label">Outgoing</div>
            <div className="fv2-stat__value">{outgoing}</div>
            <div className="fv2-stat__hint">sent to others</div>
          </div>
          <div className="fv2-stat">
            <div className="fv2-stat__label">History</div>
            <div className="fv2-stat__value">{HISTORY.length}</div>
            <div className="fv2-stat__hint">past offers</div>
          </div>
          <div className="fv2-stat">
            <div className="fv2-stat__label">Deadline</div>
            <div className="fv2-stat__value">May 16</div>
            <div className="fv2-stat__hint">trades close</div>
          </div>
        </div>
      </section>

      {/* Active offers */}
      <section className="fv2-section">
        <div className="fv2-section-head">
          <span className="fv2-section-head__title">Active offers</span>
          <span className="fv2-section-head__meta">{ACTIVE.length} pending</span>
        </div>
        {ACTIVE.length === 0 ? (
          <div className="fv2-empty">No active offers.</div>
        ) : (
          <div>
            {ACTIVE.map((t) => (
              <div key={t.id} className="fv2-trade-card">
                <div className="fv2-trade-card__head">
                  <span
                    className={`fv2-badge ${
                      t.direction === 'incoming'
                        ? 'fv2-badge--accent'
                        : ''
                    }`}
                  >
                    {t.direction}
                  </span>
                  <div>
                    <div className="fv2-trade-card__partner">{t.partner}</div>
                    <div className="fv2-trade-card__owner">
                      @{t.partnerOwner} · sent {t.ageHours}h ago
                    </div>
                  </div>
                </div>
                <div className="fv2-trade-card__bodies">
                  <div className="fv2-trade-card__side">
                    <div className="fv2-trade-card__side-label">You get</div>
                    <ul>
                      {t.youGet.map((f) => (
                        <li key={f.name}>
                          <span>{f.name}</span>
                          <span>{f.weightClass}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="fv2-trade-card__arrow">⇄</div>
                  <div className="fv2-trade-card__side">
                    <div className="fv2-trade-card__side-label">They get</div>
                    <ul>
                      {t.theyGet.map((f) => (
                        <li key={f.name}>
                          <span>{f.name}</span>
                          <span>{f.weightClass}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="fv2-trade-card__actions">
                  {t.direction === 'incoming' ? (
                    <>
                      <button className="fv2-btn fv2-btn--primary fv2-btn--sm" type="button">
                        Accept
                      </button>
                      <button className="fv2-btn fv2-btn--ghost fv2-btn--sm" type="button">
                        Counter
                      </button>
                      <button className="fv2-btn fv2-btn--ghost fv2-btn--sm" type="button">
                        Decline
                      </button>
                    </>
                  ) : (
                    <button className="fv2-btn fv2-btn--ghost fv2-btn--sm" type="button">
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
      <section className="fv2-section">
        <div className="fv2-section-head">
          <span className="fv2-section-head__title">Propose a trade</span>
          <span className="fv2-section-head__meta">shopping for talent?</span>
        </div>
        <div className="fv2-card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="fv2-stat__label" style={{ display: 'block', marginBottom: 6 }}>
                Send to team
              </label>
              <select className="fv2-select" style={{ width: '100%' }}>
                {OTHER_TEAMS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="fv2-stat__label" style={{ display: 'block', marginBottom: 6 }}>
                  You give up
                </label>
                <select className="fv2-select" multiple size={6} style={{ width: '100%' }}>
                  {MY_FIGHTER_NAMES.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="fv2-stat__label" style={{ display: 'block', marginBottom: 6 }}>
                  You receive
                </label>
                <select className="fv2-select" multiple size={6} style={{ width: '100%' }}>
                  <option>Their fighters load when team is selected</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="fv2-btn fv2-btn--primary" type="button">
                Send offer
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* History */}
      <section className="fv2-section">
        <div className="fv2-section-head">
          <span className="fv2-section-head__title">Trade history</span>
          <span className="fv2-section-head__meta">{HISTORY.length} past offers</span>
        </div>
        <div className="fv2-table-wrap">
          <table className="fv2-table">
            <thead>
              <tr>
                <th className="fv2-col-left">Direction</th>
                <th className="fv2-col-left">Partner</th>
                <th className="fv2-col-left">You got</th>
                <th className="fv2-col-left">They got</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {HISTORY.map((t) => (
                <tr key={t.id}>
                  <td className="fv2-col-left" style={{ color: 'var(--fv2-text-3)', textTransform: 'capitalize' }}>
                    {t.direction}
                  </td>
                  <td className="fv2-col-left">
                    <span className="fv2-table__name">{t.partner}</span>
                  </td>
                  <td className="fv2-col-left" style={{ color: 'var(--fv2-text-3)' }}>
                    {t.youGet.map((f) => f.name).join(', ')}
                  </td>
                  <td className="fv2-col-left" style={{ color: 'var(--fv2-text-3)' }}>
                    {t.theyGet.map((f) => f.name).join(', ')}
                  </td>
                  <td style={{ textTransform: 'capitalize' }}>{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
