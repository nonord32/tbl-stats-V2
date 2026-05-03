// src/app/fantasy/page.tsx
// Fantasy lobby — v2 redesign (dark, dense, mobile-first sports-app).
// Wrapped in .fv2 to scope dark tokens; siblings (other fantasy pages
// still on v1) keep working until Phase B migrates them.
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getAllData } from '@/lib/data';
import { ensureResolved } from '@/lib/resolve-on-read';
import { safeGetUser } from '@/lib/supabase/safe';

export const dynamic = 'force-dynamic';

interface SeasonSummary {
  wins: number;
  losses: number;
  ties: number;
  totalPoints: number;
  weeksPlayed: number;
  hasRoster: boolean;
  lastResolvedWeek: number | null;
  lastResult: 'W' | 'L' | 'T' | null;
  lastUserPts: number | null;
  lastOppPts: number | null;
}

async function loadSeasonSummary(userId: string): Promise<SeasonSummary> {
  const supabase = await createClient();
  const [{ data: roster }, { data: weeks }] = await Promise.all([
    supabase
      .from('fantasy_rosters')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('fantasy_weeks')
      .select('week, user_points, opponent_points, resolved_at')
      .eq('user_id', userId)
      .order('week', { ascending: false }),
  ]);

  let wins = 0;
  let losses = 0;
  let ties = 0;
  let totalPoints = 0;
  let lastResolvedWeek: number | null = null;
  let lastResult: 'W' | 'L' | 'T' | null = null;
  let lastUserPts: number | null = null;
  let lastOppPts: number | null = null;

  (weeks ?? []).forEach((w, i) => {
    if (!w.resolved_at) return;
    const u = Number(w.user_points ?? 0);
    const o = Number(w.opponent_points ?? 0);
    totalPoints += u;
    if (u > o) wins++;
    else if (u < o) losses++;
    else ties++;
    if (i === 0 || lastResolvedWeek === null) {
      lastResolvedWeek = w.week as number;
      lastResult = u > o ? 'W' : u < o ? 'L' : 'T';
      lastUserPts = u;
      lastOppPts = o;
    }
  });

  return {
    wins,
    losses,
    ties,
    totalPoints,
    weeksPlayed: wins + losses + ties,
    hasRoster: !!roster,
    lastResolvedWeek,
    lastResult,
    lastUserPts,
    lastOppPts,
  };
}

export default async function FantasyLobbyPage() {
  const supabase = await createClient();
  const user = await safeGetUser(supabase);

  if (user) {
    const sheetData = await getAllData();
    await ensureResolved(sheetData);
  }

  const summary = user ? await loadSeasonSummary(user.id) : null;

  const recordLine = summary
    ? `${summary.wins}-${summary.losses}${summary.ties ? `-${summary.ties}` : ''}`
    : null;

  const QUICK_ACTIONS = [
    {
      href: '/fantasy/team',
      eyebrow: summary?.hasRoster ? 'My Team' : 'Locked',
      title: 'Lineup',
      sub: summary?.hasRoster ? "Set this week's starters" : 'Draft first to unlock',
    },
    {
      href: '/fantasy/draft',
      eyebrow: summary?.hasRoster ? 'Roster saved' : 'Get started',
      title: 'Draft',
      sub: summary?.hasRoster ? 'Re-draft to roll a new roster' : 'Mock draft (~3 min)',
    },
    {
      href: '/fantasy/waiver',
      eyebrow: 'Free agents',
      title: 'Waiver',
      sub: 'Pick up undrafted fighters',
    },
    {
      href: '/fantasy/scoring',
      eyebrow: 'Box score',
      title: 'Scoring',
      sub: summary?.lastResolvedWeek
        ? `Wk ${summary.lastResolvedWeek} · ${summary.lastUserPts}–${summary.lastOppPts}`
        : 'No resolved week yet',
    },
  ];

  return (
    <div className="fv2">
      <div className="fv2-body">
        {/* Hero */}
        <section className="fv2-hero">
          <div className="fv2-hero__eyebrow">Solo vs AI · 2026 Season</div>
          <div className="fv2-hero__title">Throwing Hands FC</div>
          <div className="fv2-hero__sub">
            {user ? (
              recordLine ? (
                <>
                  <strong>{recordLine}</strong> · {summary!.totalPoints.toFixed(1)} pts ·{' '}
                  {summary!.weeksPlayed} {summary!.weeksPlayed === 1 ? 'week' : 'weeks'}
                </>
              ) : summary?.hasRoster ? (
                <>Roster saved — no resolved week yet</>
              ) : (
                <>No roster yet — run the mock draft to start</>
              )
            ) : (
              <>Sign in to save a roster across reloads</>
            )}
          </div>
          <div className="fv2-hero__actions">
            {!user ? (
              <Link href="/login?next=/fantasy" className="fv2-btn fv2-btn--primary">
                Sign in
              </Link>
            ) : summary?.hasRoster ? (
              <>
                <Link href="/fantasy/team" className="fv2-btn fv2-btn--primary">
                  Set lineup
                </Link>
                <Link href="/fantasy/scoring" className="fv2-btn fv2-btn--ghost">
                  View scoring
                </Link>
              </>
            ) : (
              <Link href="/fantasy/draft" className="fv2-btn fv2-btn--primary">
                Run mock draft
              </Link>
            )}
          </div>
        </section>

        {/* Season stats */}
        {summary?.hasRoster && summary.weeksPlayed > 0 && (
          <section className="fv2-section">
            <div className="fv2-section-head">
              <span className="fv2-section-head__title">Your season</span>
              <span className="fv2-section-head__meta">
                Last week: Wk {summary.lastResolvedWeek}
              </span>
            </div>
            <div className="fv2-stat-grid">
              <div className="fv2-stat">
                <div className="fv2-stat__label">Record</div>
                <div className="fv2-stat__value">
                  {summary.wins}-{summary.losses}
                  {summary.ties ? `-${summary.ties}` : ''}
                </div>
              </div>
              <div className="fv2-stat">
                <div className="fv2-stat__label">Total pts</div>
                <div className="fv2-stat__value">{summary.totalPoints.toFixed(1)}</div>
              </div>
              <div className="fv2-stat">
                <div className="fv2-stat__label">Weeks</div>
                <div className="fv2-stat__value">{summary.weeksPlayed}</div>
              </div>
              <div className="fv2-stat">
                <div className="fv2-stat__label">Last result</div>
                <div
                  className={`fv2-stat__value ${
                    summary.lastResult === 'W'
                      ? 'fv2-stat__value--positive'
                      : summary.lastResult === 'L'
                      ? 'fv2-stat__value--negative'
                      : ''
                  }`}
                >
                  {summary.lastResult ?? '—'}
                </div>
                {summary.lastUserPts !== null && summary.lastOppPts !== null && (
                  <div className="fv2-stat__hint">
                    {summary.lastUserPts}–{summary.lastOppPts} vs AI
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Empty / signed-in but no roster state */}
        {user && !summary?.hasRoster && (
          <section className="fv2-section">
            <div className="fv2-empty">
              No roster saved yet.{' '}
              <Link href="/fantasy/draft" className="fv2-link">
                <strong>Run the mock draft</strong>
              </Link>{' '}
              to draft your team — takes ~3 minutes against AI.
            </div>
          </section>
        )}

        {/* Quick actions */}
        <section className="fv2-section">
          <div className="fv2-section-head">
            <span className="fv2-section-head__title">Quick actions</span>
          </div>
          <div className="fv2-quick-grid">
            {QUICK_ACTIONS.map((q) => (
              <Link
                key={q.href}
                href={q.href}
                className="fv2-card fv2-card--interactive fv2-link"
              >
                <div className="fv2-card__eyebrow">{q.eyebrow}</div>
                <div className="fv2-card__title">{q.title}</div>
                <div className="fv2-card__sub">{q.sub}</div>
              </Link>
            ))}
          </div>
        </section>

        {/* Coming soon — leagues teaser */}
        <section className="fv2-section">
          <div className="fv2-section-head">
            <span className="fv2-section-head__title">Coming soon</span>
            <span className="fv2-section-head__meta">Multi-user leagues</span>
          </div>
          <div className="fv2-quick-grid">
            <div className="fv2-card" style={{ opacity: 0.65 }}>
              <div className="fv2-card__eyebrow">League</div>
              <div className="fv2-card__title">Invite friends</div>
              <div className="fv2-card__sub">
                Create a private league and invite friends with a single link.
                Live snake draft with a clock, FAAB waivers, trades.
              </div>
            </div>
            <div className="fv2-card" style={{ opacity: 0.65 }}>
              <div className="fv2-card__eyebrow">Live</div>
              <div className="fv2-card__title">In-progress scoring</div>
              <div className="fv2-card__sub">
                Lineup totals tick up during matches as the sheet updates,
                not just after the match ends.
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
