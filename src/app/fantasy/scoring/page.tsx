// src/app/fantasy/scoring/page.tsx
// v2 redesign — bout-by-bout scoring view with the new dark sports-app
// look. Re-derives points from real fighterHistory on every render so
// sheet edits flow through without an admin step (auto-resolve handles
// the DB persistence side).
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { safeGetUser } from '@/lib/supabase/safe';
import { getAllData } from '@/lib/data';
import { ensureResolved } from '@/lib/resolve-on-read';
import { scoreLineup, type ScoredBout } from '@/lib/fantasyData';
import { SCORING_RULES } from '@/lib/fantasyMock';

export const dynamic = 'force-dynamic';

const STARTER_LABELS = ['Female', 'Light', 'Welter', 'Middle', 'Heavy', 'FLEX', 'FLEX'];

interface ScoredBoutWithSlot extends ScoredBout { slot: string }

export default async function FantasyScoringPage() {
  const supabase = await createClient();
  const user = await safeGetUser(supabase);
  if (!user) {
    redirect('/fantasy/login?next=/fantasy/scoring');
  }

  const sheet = await getAllData();
  await ensureResolved(sheet);

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
      <div className="fv2-body">
        <div className="fv2-empty">
          No fantasy weeks yet. Run the mock draft, set a lineup, and check
          back after the week&apos;s matches resolve.
        </div>
      </div>
    );
  }

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
    avg: 0,
    owned: 0,
    status: 'active' as const,
  }));

  const week = row.week as number;
  const starterSlugs = (row.starter_slugs as string[]) ?? [];
  const oppSlugs = (row.opponent_starter_slugs as string[]) ?? [];

  const userScore = scoreLineup(starterSlugs, pool, sheet.fighterHistory, matchIndexToWeek, week);
  const oppScore = scoreLineup(oppSlugs, pool, sheet.fighterHistory, matchIndexToWeek, week);

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
    <div className="fv2-body">
      {/* Hero with scoreboard */}
      <section className="fv2-hero">
        <div className="fv2-hero__eyebrow">
          {isResolved ? `Final · Week ${week}` : `In progress · Week ${week}`}
        </div>
        <div className="fv2-hero__title">
          {result === 'W' ? 'Winner' : result === 'L' ? 'Defeat' : 'Tied'}
        </div>
        <div
          style={{
            marginTop: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            maxWidth: 480,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--fv2-text-3)' }}>
              You
            </span>
            <span
              style={{
                fontSize: 56,
                fontWeight: 700,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
                color: result === 'W' ? 'var(--fv2-accent-bright)' : 'var(--fv2-text-1)',
              }}
            >
              {userScore.total}
            </span>
          </div>
          <span style={{ fontSize: 36, color: 'var(--fv2-text-3)' }}>—</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--fv2-text-3)' }}>
              AI Opponent
            </span>
            <span
              style={{
                fontSize: 56,
                fontWeight: 700,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
                color: result === 'L' ? 'var(--fv2-accent-bright)' : 'var(--fv2-text-1)',
              }}
            >
              {oppScore.total}
            </span>
          </div>
        </div>
        <div style={{ marginTop: 22 }}>
          {!isResolved ? (
            <span className="fv2-badge fv2-badge--live">Live · sheet-driven</span>
          ) : (
            <span className="fv2-badge fv2-badge--positive">Resolved</span>
          )}
        </div>
      </section>

      {/* Your bouts */}
      <section className="fv2-section">
        <div className="fv2-section-head">
          <span className="fv2-section-head__title">Bout by bout · your starters</span>
          <span className="fv2-section-head__meta">{userScore.total} pts</span>
        </div>
        <div className="fv2-table-wrap">
          <table className="fv2-table">
            <thead>
              <tr>
                <th className="fv2-col-left">Slot</th>
                <th className="fv2-col-left">Fighter</th>
                <th className="fv2-col-left">Bout</th>
                <th>Result</th>
                <th className="fv2-col-left">Method</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {userBoutsWithSlot.map((b, i) => (
                <tr key={`${b.fighterSlug}-${i}`}>
                  <td className="fv2-col-left fv2-roster__slot">{b.slot}</td>
                  <td className="fv2-col-left">
                    <span className="fv2-table__name">{b.fighterName}</span>
                  </td>
                  <td className="fv2-col-left" style={{ color: 'var(--fv2-text-3)' }}>
                    {b.matchIndex < 0
                      ? '—'
                      : `vs ${b.opponent}${b.date ? ` · ${b.date}` : ''}`}
                  </td>
                  <td>
                    <span
                      className={`fv2-result-badge ${
                        b.result === 'W'
                          ? 'fv2-result-badge--w'
                          : b.result === 'L'
                          ? 'fv2-result-badge--l'
                          : ''
                      }`}
                    >
                      {b.result === 'D' ? '—' : b.result}
                    </span>
                  </td>
                  <td className="fv2-col-left" style={{ color: 'var(--fv2-text-3)' }}>
                    {b.method}
                  </td>
                  <td
                    style={{
                      fontWeight: 700,
                      color:
                        b.points > 0
                          ? 'var(--fv2-positive)'
                          : b.points < 0
                          ? 'var(--fv2-negative)'
                          : 'var(--fv2-text-3)',
                    }}
                  >
                    {b.points > 0 ? '+' : ''}
                    {b.points}
                  </td>
                </tr>
              ))}
              <tr className="is-totals">
                <td colSpan={5} className="fv2-col-left">
                  Total
                </td>
                <td style={{ color: 'var(--fv2-accent-bright)' }}>
                  {userScore.total}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Opponent bouts */}
      <section className="fv2-section">
        <div className="fv2-section-head">
          <span className="fv2-section-head__title">AI opponent</span>
          <span className="fv2-section-head__meta">{oppScore.total} pts</span>
        </div>
        <div className="fv2-table-wrap">
          <table className="fv2-table">
            <thead>
              <tr>
                <th className="fv2-col-left">Fighter</th>
                <th className="fv2-col-left">Bout</th>
                <th>Result</th>
                <th className="fv2-col-left">Method</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {oppScore.bouts.map((b, i) => (
                <tr key={`opp-${b.fighterSlug}-${i}`}>
                  <td className="fv2-col-left">
                    <span className="fv2-table__name">{b.fighterName}</span>
                  </td>
                  <td className="fv2-col-left" style={{ color: 'var(--fv2-text-3)' }}>
                    {b.matchIndex < 0
                      ? '—'
                      : `vs ${b.opponent}${b.date ? ` · ${b.date}` : ''}`}
                  </td>
                  <td>
                    <span
                      className={`fv2-result-badge ${
                        b.result === 'W'
                          ? 'fv2-result-badge--w'
                          : b.result === 'L'
                          ? 'fv2-result-badge--l'
                          : ''
                      }`}
                    >
                      {b.result === 'D' ? '—' : b.result}
                    </span>
                  </td>
                  <td className="fv2-col-left" style={{ color: 'var(--fv2-text-3)' }}>
                    {b.method}
                  </td>
                  <td
                    style={{
                      fontWeight: 700,
                      color:
                        b.points > 0
                          ? 'var(--fv2-positive)'
                          : b.points < 0
                          ? 'var(--fv2-negative)'
                          : 'var(--fv2-text-3)',
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

      {/* Scoring rules */}
      <section className="fv2-section">
        <div className="fv2-section-head">
          <span className="fv2-section-head__title">Scoring rules · per bout</span>
        </div>
        <div className="fv2-rules-grid">
          {SCORING_RULES.map((r) => {
            const isPos = r.pts.startsWith('+');
            const isNeg = r.pts.startsWith('-');
            return (
              <div key={r.label} className="fv2-rule">
                <div className="fv2-rule__label">{r.label}</div>
                <div
                  className={`fv2-rule__pts ${
                    isPos
                      ? 'fv2-rule__pts--positive'
                      : isNeg
                      ? 'fv2-rule__pts--negative'
                      : ''
                  }`}
                >
                  {r.pts}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
