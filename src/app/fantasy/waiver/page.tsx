// src/app/fantasy/waiver/page.tsx
// Free agents come from real TBL data via getFantasyData(); pending
// claims, priority order, and processing window are mock until Stage 4
// (FAAB waivers) ships.
import { getFantasyData } from '@/lib/fantasyData';

export const dynamic = 'force-dynamic';

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

export default async function FantasyWaiverPage() {
  const { freeAgents } = await getFantasyData();
  const FREE_AGENTS = [...freeAgents].sort((a, b) => b.avg - a.avg);

  return (
    <div className="fv2-body">
      {/* Hero */}
      <section className="fv2-hero">
        <div className="fv2-hero__eyebrow">Waiver Wire · Mock</div>
        <div className="fv2-hero__title">Free Agents</div>
        <div className="fv2-hero__sub">
          Claims process <strong>Wed 3:00 AM ET</strong> · Your priority{' '}
          <strong>#4 of 10</strong>
        </div>
      </section>

      {/* Stat strip */}
      <section className="fv2-section">
        <div className="fv2-stat-grid">
          <div className="fv2-stat">
            <div className="fv2-stat__label">Pending</div>
            <div className="fv2-stat__value">{PENDING_CLAIMS.length}</div>
            <div className="fv2-stat__hint">claims queued</div>
          </div>
          <div className="fv2-stat">
            <div className="fv2-stat__label">Priority</div>
            <div className="fv2-stat__value">#4</div>
            <div className="fv2-stat__hint">of 10 teams</div>
          </div>
          <div className="fv2-stat">
            <div className="fv2-stat__label">Available</div>
            <div className="fv2-stat__value">{FREE_AGENTS.length}</div>
            <div className="fv2-stat__hint">free agents</div>
          </div>
          <div className="fv2-stat">
            <div className="fv2-stat__label">Process</div>
            <div className="fv2-stat__value fv2-stat__value--accent">3 AM</div>
            <div className="fv2-stat__hint">Wednesday ET</div>
          </div>
        </div>
      </section>

      {/* Pending claims */}
      <section className="fv2-section">
        <div className="fv2-section-head">
          <span className="fv2-section-head__title">My pending claims</span>
          <span className="fv2-section-head__meta">drag to reorder priority</span>
        </div>
        {PENDING_CLAIMS.length === 0 ? (
          <div className="fv2-empty">No pending claims.</div>
        ) : (
          <div>
            {PENDING_CLAIMS.map((c, i) => (
              <div key={c.fighter} className="fv2-claim-row">
                <div className="fv2-claim-row__order">{i + 1}</div>
                <div className="fv2-claim-row__body">
                  <div className="fv2-claim-row__heading">
                    <span className="fv2-claim-row__add">+ {c.fighter}</span>
                    <span className="fv2-claim-row__sep">/</span>
                    <span className="fv2-claim-row__drop">– {c.drop}</span>
                  </div>
                  <div className="fv2-claim-row__meta">
                    {c.weightClass} · {c.team} · processes {c.processes}
                  </div>
                </div>
                <div className="fv2-claim-row__actions">
                  <button className="fv2-action-btn" type="button">
                    Edit
                  </button>
                  <button className="fv2-action-btn" type="button">
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Free agent pool */}
      <section className="fv2-section">
        <div className="fv2-section-head">
          <span className="fv2-section-head__title">
            Available · {FREE_AGENTS.length} free agents
          </span>
          <span className="fv2-section-head__meta">sorted by season avg</span>
        </div>
        <div className="fv2-filters">
          <input className="fv2-input" placeholder="Search…" />
          <select className="fv2-select">
            <option>All weights</option>
            <option>Featherweight</option>
            <option>Lightweight</option>
            <option>Middleweight</option>
            <option>Light Heavyweight</option>
            <option>Bantamweight</option>
          </select>
        </div>
        <div className="fv2-table-wrap">
          <table className="fv2-table">
            <thead>
              <tr>
                <th className="fv2-col-left">Fighter</th>
                <th className="fv2-col-left">Team</th>
                <th className="fv2-col-left">Class</th>
                <th>Avg</th>
                <th>Owned</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {FREE_AGENTS.map((f) => (
                <tr key={f.id}>
                  <td className="fv2-col-left">
                    <span className="fv2-table__name">{f.name}</span>
                  </td>
                  <td className="fv2-col-left" style={{ color: 'var(--fv2-text-3)' }}>
                    {f.city}
                  </td>
                  <td className="fv2-col-left" style={{ color: 'var(--fv2-text-3)' }}>
                    {f.weightClass}
                  </td>
                  <td>{f.avg.toFixed(1)}</td>
                  <td>{f.owned}%</td>
                  <td>
                    <button className="fv2-action-btn fv2-action-btn--active" type="button">
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
  );
}
