// src/app/fantasy/waiver/page.tsx
// Free agents + waiver claim queue. Mock UI only.
import { POOL } from '@/lib/fantasyMock';

export const dynamic = 'force-dynamic';

const FREE_AGENTS = POOL.filter((f) => f.status === 'free').sort(
  (a, b) => b.projected - a.projected
);

const PENDING_CLAIMS = [
  {
    fighter: 'Eli Whelan',
    weightClass: 'Light Heavyweight',
    team: 'Boston Butchers',
    drop: 'Tomás Arnaud',
    priority: 4,
    processes: 'Wed 3:00 AM ET',
  },
  {
    fighter: 'Jeovanny Estela',
    weightClass: 'Middleweight',
    team: 'Miami Assassins',
    drop: 'Sami Pereira',
    priority: 4,
    processes: 'Wed 3:00 AM ET',
  },
];

export default function FantasyWaiverPage() {
  return (
    <>
      <div className="fantasy-hero fantasy-hero--compact">
        <div>
          <div className="tbl-eyebrow" style={{ color: 'var(--tbl-accent-bright)' }}>
            Waiver Wire
          </div>
          <div className="tbl-display fantasy-hero__title">Free Agents</div>
          <div className="fantasy-hero__sub">
            Claims process Wed 3:00 AM ET · Your priority: #4 of 10
          </div>
        </div>
        <div className="fantasy-hero__stats">
          <div>
            <div className="fantasy-hero__stat-label">Pending</div>
            <div className="tbl-display fantasy-hero__stat-value">
              {PENDING_CLAIMS.length}
            </div>
          </div>
          <div>
            <div className="fantasy-hero__stat-label">Priority</div>
            <div className="tbl-display fantasy-hero__stat-value">#4</div>
          </div>
        </div>
      </div>

      <div className="fantasy-body">
        {/* Pending claims */}
        <section className="fantasy-section">
          <div className="tbl-section-rule">
            <span>My Pending Claims</span>
            <span>Drag to reorder priority</span>
          </div>
          {PENDING_CLAIMS.length === 0 ? (
            <div className="fantasy-empty">No pending claims.</div>
          ) : (
            <div className="fantasy-claims">
              {PENDING_CLAIMS.map((c, i) => (
                <div key={c.fighter} className="fantasy-claim-row">
                  <div className="fantasy-claim-row__order">{i + 1}</div>
                  <div className="fantasy-claim-row__body">
                    <div className="fantasy-claim-row__heading">
                      <span className="fantasy-claim-row__add">+ {c.fighter}</span>
                      <span className="fantasy-claim-row__sep">/</span>
                      <span className="fantasy-claim-row__drop">– {c.drop}</span>
                    </div>
                    <div className="fantasy-claim-row__meta">
                      {c.weightClass} · {c.team} · processes {c.processes}
                    </div>
                  </div>
                  <div className="fantasy-claim-row__actions">
                    <button className="fantasy-btn fantasy-btn--ghost" type="button">
                      Edit
                    </button>
                    <button
                      className="fantasy-btn fantasy-btn--ghost"
                      type="button"
                      style={{ color: 'var(--tbl-red)', borderColor: 'var(--tbl-red)' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Free agent pool */}
        <section className="fantasy-section">
          <div className="tbl-section-rule">
            <span>Available · {FREE_AGENTS.length} free agents</span>
            <span>Sorted by Projected</span>
          </div>
          <div className="fantasy-draft-filters">
            <input className="fantasy-input" placeholder="Search…" />
            <select className="fantasy-select">
              <option>All weights</option>
              <option>Featherweight</option>
              <option>Lightweight</option>
              <option>Middleweight</option>
              <option>Light Heavyweight</option>
              <option>Bantamweight</option>
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
                  <th className="num">Action</th>
                </tr>
              </thead>
              <tbody>
                {FREE_AGENTS.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <span className="fantasy-table__team">{f.name}</span>
                    </td>
                    <td className="muted">{f.city}</td>
                    <td className="muted">{f.weightClass}</td>
                    <td className="num mono">{f.projected.toFixed(1)}</td>
                    <td className="num mono">{f.avg.toFixed(1)}</td>
                    <td className="num">
                      <button
                        className="fantasy-btn fantasy-btn--primary fantasy-btn--small"
                        type="button"
                      >
                        Claim
                      </button>
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
