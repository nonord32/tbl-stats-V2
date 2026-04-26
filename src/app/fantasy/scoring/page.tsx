// src/app/fantasy/scoring/page.tsx
// Real weekly scoring. Reads the user's most-recently-resolved
// fantasy_weeks row and re-computes the bout-by-bout breakdown from
// real fighterHistory (so the rendered points always reflect what's
// in the source sheet, even after re-resolutions).
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { safeGetUser } from '@/lib/supabase/safe';
import { getAllData } from '@/lib/data';
import { scoreLineup, type ScoredBout } from '@/lib/fantasyData';
import { SCORING_RULES } from '@/lib/fantasyMock';

export const dynamic = 'force-dynamic';

const STARTER_LABELS = ['Female', 'Light', 'Welter', 'Middle', 'Heavy', 'FLEX', 'FLEX'];

interface ScoredBoutWithSlot extends ScoredBout { slot: string }

export default async function FantasyScoringPage() {
  const supabase = await createClient();
  const user = await safeGetUser(supabase);
  if (!user) {
    redirect('/login?next=/fantasy/scoring');
  }

  // Most recent week we've created for this user. Prefer resolved.
  const { data: rows } = await supabase
    .from('fantasy_weeks')
    .select('week, starter_slugs, opponent_starter_slugs, user_points, opponent_points, resolved_at, locks_at')
    .eq('user_id', user.id)
    .order('week', { ascending: false })
    .limit(5);

  const resolvedRow = rows?.find((r) => r.resolved_at) ?? null;
  const fallbackRow = rows?.[0] ?? null;
  const row = resolvedRow ?? fallbackRow;

  if (!row) {
    return (
      <div className="fantasy-body">
        <div className="fantasy-empty">
          No fantasy weeks yet. Run the mock draft, set a lineup, and check
          back after the week&apos;s matches resolve.
        </div>
      </div>
    );
  }

  // Re-derive points from real data so we never display stale numbers if
  // results changed in the sheet. (DB columns are still authoritative for
  // win/loss bookkeeping.)
  const sheet = await getAllData();
  const matchIndexToWeek = new Map<number, number>();
  sheet.schedule.forEach((s) => {
    if (s.matchIndex != null) matchIndexToWeek.set(s.matchIndex, Number(s.week));
  });
  const pool = sheet.fighters.map((f) => ({
    id: f.slug,
    name: f.name,
    team: f.team,
    city: f.team,
    weightClass: f.weightClass,
    gender: (f.gender === 'Female' ? 'Female' : 'Male') as 'Female' | 'Male',
    projected: 0,
    avg: 0,
    owned: 0,
    status: 'active' as const,
  }));

  const week = row.week as number;
  const starterSlugs = (row.starter_slugs as string[]) ?? [];
  const oppSlugs = (row.opponent_starter_slugs as string[]) ?? [];

  const userScore = scoreLineup(starterSlugs, pool, sheet.fighterHistory, matchIndexToWeek, week);
  const oppScore = scoreLineup(oppSlugs, pool, sheet.fighterHistory, matchIndexToWeek, week);

  // Tag each user bout with its slot label (best-effort by index).
  const userBoutsWithSlot: ScoredBoutWithSlot[] = userScore.bouts.map((b, i) => ({
    ...b,
    slot: STARTER_LABELS[i] ?? '—',
  }));

  const isResolved = !!row.resolved_at;
  const result: 'W' | 'L' | 'T' =
    userScore.total > oppScore.total
      ? 'W'
      : userScore.total < oppScore.total
      ? 'L'
      : 'T';

  return (
    <>
      <div className="fantasy-hero fantasy-hero--scoring">
        <div className="fantasy-hero__sideline">
          <div className="tbl-eyebrow" style={{ color: 'var(--tbl-accent-bright)' }}>
            {isResolved ? `Final · Week ${week}` : `In progress · Week ${week}`}
          </div>
          <div className="tbl-display fantasy-hero__title">Throwing Hands FC</div>
          <div className="fantasy-hero__sub">
            {isResolved
              ? result === 'W'
                ? 'Winner'
                : result === 'L'
                ? 'Loser'
                : 'Tie'
              : 'Awaiting admin resolution'}
          </div>
        </div>
        <div className="fantasy-hero__matchup">
          <div className="fantasy-hero__matchup-side">
            <div className="fantasy-hero__matchup-team">You</div>
            <div
              className="tbl-display fantasy-hero__matchup-score"
              style={{
                color:
                  result === 'W'
                    ? 'var(--tbl-accent-bright)'
                    : 'var(--tbl-bg)',
              }}
            >
              {userScore.total}
            </div>
          </div>
          <div className="fantasy-hero__matchup-dash">—</div>
          <div className="fantasy-hero__matchup-side">
            <div
              className="tbl-display fantasy-hero__matchup-score"
              style={{
                color:
                  result === 'L'
                    ? 'var(--tbl-accent-bright)'
                    : 'var(--tbl-bg)',
              }}
            >
              {oppScore.total}
            </div>
            <div className="fantasy-hero__matchup-team">AI Opponent</div>
          </div>
        </div>
      </div>

      <div className="fantasy-body">
        {!isResolved && (
          <div
            style={{
              background: 'var(--tbl-paper)',
              border: '1.5px solid var(--tbl-ink)',
              padding: '12px 16px',
              fontFamily: 'var(--tbl-font-mono)',
              fontSize: 12,
              marginBottom: 16,
              color: 'var(--tbl-ink-soft)',
            }}
          >
            Showing live points based on what&apos;s currently in the sheet.
            Points lock when an admin runs Resolve Fantasy after the week&apos;s
            matches finalize.
          </div>
        )}
        <section className="fantasy-section">
          <div className="tbl-section-rule">
            <span>Bout by Bout</span>
            <span>Your starters</span>
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
                {userBoutsWithSlot.map((b, i) => (
                  <tr key={`${b.fighterSlug}-${i}`}>
                    <td className="muted" style={{ textTransform: 'uppercase' }}>
                      {b.slot}
                    </td>
                    <td>
                      <span className="fantasy-table__team">{b.fighterName}</span>
                    </td>
                    <td className="muted">
                      {b.matchIndex < 0
                        ? '—'
                        : `vs ${b.opponent}${b.date ? ` · ${b.date}` : ''}`}
                    </td>
                    <td>
                      <span
                        className="fantasy-result-badge"
                        style={{
                          background:
                            b.result === 'W'
                              ? 'var(--tbl-green)'
                              : b.result === 'L'
                              ? 'var(--tbl-red)'
                              : 'var(--tbl-ink-mute)',
                        }}
                      >
                        {b.result === 'D' ? '—' : b.result}
                      </span>
                    </td>
                    <td className="muted">{b.method}</td>
                    <td
                      className="num mono"
                      style={{
                        fontWeight: 700,
                        color:
                          b.points > 0
                            ? 'var(--tbl-green)'
                            : b.points < 0
                            ? 'var(--tbl-red)'
                            : 'var(--tbl-ink-soft)',
                      }}
                    >
                      {b.points > 0 ? '+' : ''}
                      {b.points}
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
                    {userScore.total}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="fantasy-section">
          <div className="tbl-section-rule">
            <span>AI Opponent · {oppScore.total} pts</span>
            <span>Auto-generated each week</span>
          </div>
          <div className="fantasy-table-wrap">
            <table className="fantasy-table">
              <thead>
                <tr>
                  <th>Fighter</th>
                  <th>Bout</th>
                  <th>Result</th>
                  <th>Method</th>
                  <th className="num">Pts</th>
                </tr>
              </thead>
              <tbody>
                {oppScore.bouts.map((b, i) => (
                  <tr key={`opp-${b.fighterSlug}-${i}`}>
                    <td>
                      <span className="fantasy-table__team">{b.fighterName}</span>
                    </td>
                    <td className="muted">
                      {b.matchIndex < 0
                        ? '—'
                        : `vs ${b.opponent}${b.date ? ` · ${b.date}` : ''}`}
                    </td>
                    <td>
                      <span
                        className="fantasy-result-badge"
                        style={{
                          background:
                            b.result === 'W'
                              ? 'var(--tbl-green)'
                              : b.result === 'L'
                              ? 'var(--tbl-red)'
                              : 'var(--tbl-ink-mute)',
                        }}
                      >
                        {b.result === 'D' ? '—' : b.result}
                      </span>
                    </td>
                    <td className="muted">{b.method}</td>
                    <td
                      className="num mono"
                      style={{
                        fontWeight: 700,
                        color:
                          b.points > 0
                            ? 'var(--tbl-green)'
                            : b.points < 0
                            ? 'var(--tbl-red)'
                            : 'var(--tbl-ink-soft)',
                      }}
                    >
                      {b.points > 0 ? '+' : ''}
                      {b.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

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

        {/* Server-resolved persistence note (so admin knows the week's authority status) */}
        {isResolved && (
          <div
            style={{
              fontFamily: 'var(--tbl-font-mono)',
              fontSize: 11,
              color: 'var(--tbl-ink-soft)',
              marginTop: 8,
            }}
          >
            Resolved via admin · {row.user_points ?? userScore.total} —{' '}
            {row.opponent_points ?? oppScore.total} (DB record)
          </div>
        )}
      </div>
    </>
  );
}
