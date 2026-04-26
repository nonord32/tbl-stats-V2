// src/app/fantasy/team/page.tsx
// My team: 7 active lineup slots + bench of reserves. Mock data, no
// interactivity — buttons are visual stubs.
import {
  ME,
  MY_LINEUP,
  MY_BENCH,
  SLOT_LABELS,
  SLOT_RULES,
  type FantasyFighter,
} from '@/lib/fantasyMock';

export const dynamic = 'force-dynamic';

const TOTAL_PROJECTED = MY_LINEUP.reduce(
  (sum, slot) => sum + (slot.fighter?.projected ?? 0),
  0
);

function StatusPill({ status }: { status: FantasyFighter['status'] }) {
  const map: Record<FantasyFighter['status'], { label: string; cls: string }> = {
    active:        { label: 'Active',  cls: 'is-active' },
    questionable:  { label: 'Q',       cls: 'is-q' },
    out:           { label: 'Out',     cls: 'is-out' },
    free:          { label: 'FA',      cls: 'is-fa' },
  };
  const m = map[status];
  return <span className={`fantasy-status-pill ${m.cls}`}>{m.label}</span>;
}

export default function FantasyTeamPage() {
  return (
    <>
      <div className="fantasy-hero fantasy-hero--compact">
        <div>
          <div className="tbl-eyebrow" style={{ color: 'var(--tbl-accent-bright)' }}>
            My Team · Wk 11 Lineup
          </div>
          <div className="tbl-display fantasy-hero__title">{ME.team.name}</div>
          <div className="fantasy-hero__sub">
            {ME.team.record} · #{ME.team.rank} · Locks Fri 4/24 · 8:00 ET
          </div>
        </div>
        <div className="fantasy-hero__stats">
          <div>
            <div className="fantasy-hero__stat-label">Projected</div>
            <div className="tbl-display fantasy-hero__stat-value">
              {TOTAL_PROJECTED.toFixed(1)}
            </div>
          </div>
          <div>
            <div className="fantasy-hero__stat-label">Opp Proj</div>
            <div className="tbl-display fantasy-hero__stat-value">36.2</div>
          </div>
        </div>
      </div>

      <div className="fantasy-body">
        <section className="fantasy-section">
          <div className="tbl-section-rule">
            <span>Active Lineup · 7 Slots</span>
            <span>Tap a slot to swap</span>
          </div>
          <div className="fantasy-lineup">
            {MY_LINEUP.map((row) => (
              <div key={row.slot} className="fantasy-lineup__row">
                <div className="fantasy-lineup__slot">
                  <div className="fantasy-lineup__slot-label">
                    {SLOT_LABELS[row.slot]}
                  </div>
                  <div className="fantasy-lineup__slot-rule">
                    {SLOT_RULES[row.slot]}
                  </div>
                </div>
                {row.fighter ? (
                  <>
                    <div className="fantasy-lineup__fighter">
                      <div className="fantasy-lineup__name">
                        {row.fighter.name}
                      </div>
                      <div className="fantasy-lineup__meta">
                        {row.fighter.team} · {row.fighter.weightClass}
                      </div>
                      {row.opponent && (
                        <div className="fantasy-lineup__matchup">
                          vs {row.opponent} · {row.fight}
                        </div>
                      )}
                    </div>
                    <StatusPill status={row.fighter.status} />
                    <div className="fantasy-lineup__proj">
                      <div className="fantasy-lineup__proj-label">Proj</div>
                      <div className="fantasy-lineup__proj-value">
                        {row.fighter.projected.toFixed(1)}
                      </div>
                    </div>
                    <button className="fantasy-btn fantasy-btn--ghost" type="button">
                      Swap
                    </button>
                  </>
                ) : (
                  <div className="fantasy-lineup__empty">Empty slot · pick a fighter</div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="fantasy-section">
          <div className="tbl-section-rule">
            <span>Bench · {MY_BENCH.length} Reserves</span>
            <span>Drag onto a slot to start them</span>
          </div>
          <div className="fantasy-bench-grid">
            {MY_BENCH.map((b) => (
              <div key={b.fighter.id} className="fantasy-bench-card">
                <div className="fantasy-bench-card__head">
                  <div>
                    <div className="fantasy-bench-card__name">{b.fighter.name}</div>
                    <div className="fantasy-bench-card__meta">
                      {b.fighter.team} · {b.fighter.weightClass}
                    </div>
                  </div>
                  <StatusPill status={b.fighter.status} />
                </div>
                <div className="fantasy-bench-card__body">
                  <div>
                    <div className="fantasy-bench-card__stat-label">Proj</div>
                    <div className="fantasy-bench-card__stat-value">
                      {b.fighter.projected.toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <div className="fantasy-bench-card__stat-label">Avg</div>
                    <div className="fantasy-bench-card__stat-value">
                      {b.fighter.avg.toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <div className="fantasy-bench-card__stat-label">Owned</div>
                    <div className="fantasy-bench-card__stat-value">
                      {b.fighter.owned}%
                    </div>
                  </div>
                </div>
                <div className="fantasy-bench-card__matchup">
                  {b.opponent ? `vs ${b.opponent}` : 'No fight this week'}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
