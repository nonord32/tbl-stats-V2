// src/app/fantasy/page.tsx
// Lobby — entry point for fantasy. For signed-in users with a saved
// roster, shows a real solo-vs-AI season record card built from
// fantasy_weeks. League join/create + standings stay mock for now.
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

  const weeksPlayed = wins + losses + ties;

  return {
    wins,
    losses,
    ties,
    totalPoints,
    weeksPlayed,
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

  // Resolve any fantasy weeks now scorable from sheet state before reading
  // the user's record. Idempotent + cheap when nothing's pending.
  if (user) {
    const sheetData = await getAllData();
    await ensureResolved(sheetData);
  }

  const summary = user
    ? await loadSeasonSummary(user.id)
    : null;

  const recordLine = summary
    ? `${summary.wins}-${summary.losses}${summary.ties ? `-${summary.ties}` : ''} · ${summary.totalPoints.toFixed(1)} pts`
    : 'Sign in to start';

  const lastWeekLabel = summary?.lastResolvedWeek
    ? `Wk ${summary.lastResolvedWeek}: You ${summary.lastUserPts} — ${summary.lastOppPts} AI (${summary.lastResult})`
    : summary?.hasRoster
    ? 'No resolved week yet'
    : 'Run the mock draft to start';

  return (
    <>
      {/* Dark hero */}
      <div className="fantasy-hero">
        <div>
          <div className="tbl-eyebrow" style={{ color: 'var(--tbl-accent-bright)' }}>
            Solo vs AI · 2026 Season
          </div>
          <div className="tbl-display fantasy-hero__title">Throwing Hands FC</div>
          <div className="fantasy-hero__sub">{recordLine}</div>
        </div>
        <div className="fantasy-hero__actions">
          {summary?.hasRoster ? (
            <Link href="/fantasy/team" className="fantasy-btn fantasy-btn--primary">
              Set lineup →
            </Link>
          ) : (
            <Link href="/fantasy/draft" className="fantasy-btn fantasy-btn--primary">
              Run mock draft →
            </Link>
          )}
          <Link href="/fantasy/scoring" className="fantasy-btn fantasy-btn--ghost">
            Scoring
          </Link>
        </div>
      </div>

      <div className="fantasy-body">
        {/* Personal record card — replaces the mock standings table */}
        <section className="fantasy-section">
          <div className="tbl-section-rule">
            <span>Your Solo Season</span>
            <span>{user ? '@' + (user.email?.split('@')[0] ?? 'you') : 'Not signed in'}</span>
          </div>
          {!user ? (
            <div className="fantasy-empty">
              Fantasy needs you signed in to save your roster across reloads.{' '}
              <Link
                href="/login?next=/fantasy"
                className="fantasy-btn fantasy-btn--primary fantasy-btn--small"
                style={{ marginLeft: 8 }}
              >
                Sign in
              </Link>
            </div>
          ) : !summary?.hasRoster ? (
            <div className="fantasy-empty">
              No roster saved yet. Hit{' '}
              <Link href="/fantasy/draft" style={{ color: 'var(--tbl-accent)' }}>
                /fantasy/draft
              </Link>{' '}
              to draft your team — takes ~3 minutes against AI opponents.
            </div>
          ) : (
            <div className="fantasy-summary-grid">
              <div className="fantasy-summary-card">
                <div className="fantasy-summary-card__label">Record</div>
                <div className="fantasy-summary-card__value">
                  {summary.wins}-{summary.losses}
                  {summary.ties ? `-${summary.ties}` : ''}
                </div>
              </div>
              <div className="fantasy-summary-card">
                <div className="fantasy-summary-card__label">Total Pts</div>
                <div className="fantasy-summary-card__value">
                  {summary.totalPoints.toFixed(1)}
                </div>
              </div>
              <div className="fantasy-summary-card">
                <div className="fantasy-summary-card__label">Weeks</div>
                <div className="fantasy-summary-card__value">
                  {summary.weeksPlayed}
                </div>
              </div>
              <div className="fantasy-summary-card">
                <div className="fantasy-summary-card__label">Last Result</div>
                <div
                  className="fantasy-summary-card__value"
                  style={{
                    color:
                      summary.lastResult === 'W'
                        ? 'var(--tbl-green)'
                        : summary.lastResult === 'L'
                        ? 'var(--tbl-red)'
                        : 'var(--tbl-ink)',
                  }}
                >
                  {summary.lastResult ?? '—'}
                </div>
              </div>
            </div>
          )}
          <p
            className="fantasy-cta-card__copy"
            style={{ marginTop: 12, fontSize: 11 }}
          >
            {lastWeekLabel}
          </p>
        </section>

        {/* Quick links */}
        <section className="fantasy-section">
          <div className="tbl-section-rule">
            <span>Quick Actions</span>
          </div>
          <div className="fantasy-quick-grid">
            {[
              { href: '/fantasy/draft',   eyebrow: summary?.hasRoster ? 'Roster saved' : 'Get started', title: 'Draft', sub: summary?.hasRoster ? 'Re-draft to roll a new roster' : 'Run a mock draft (~3 min)' },
              { href: '/fantasy/team',    eyebrow: 'My Team', title: 'Lineup', sub: summary?.hasRoster ? 'Set this week\'s starters' : 'Draft first to unlock' },
              { href: '/fantasy/waiver',  eyebrow: 'Mock', title: 'Waiver', sub: 'Free agents (preview)' },
              { href: '/fantasy/scoring', eyebrow: 'Scoreboard', title: 'Scoring', sub: lastWeekLabel },
            ].map((q) => (
              <Link key={q.href} href={q.href} className="fantasy-quick-card">
                <div className="tbl-eyebrow">{q.eyebrow}</div>
                <div
                  className="tbl-display"
                  style={{ fontSize: 28, lineHeight: 1, marginTop: 4 }}
                >
                  {q.title}
                </div>
                <div className="fantasy-quick-card__sub">{q.sub}</div>
              </Link>
            ))}
          </div>
        </section>

        {/* Future-features placeholder */}
        <section className="fantasy-section">
          <div className="tbl-section-rule">
            <span>Coming Later</span>
            <span>Multi-user leagues</span>
          </div>
          <div className="fantasy-cta-grid">
            <div className="fantasy-cta-card" style={{ opacity: 0.7 }}>
              <div className="tbl-eyebrow">Join League</div>
              <div className="tbl-display" style={{ fontSize: 28, lineHeight: 1, marginTop: 4 }}>
                With friends
              </div>
              <p className="fantasy-cta-card__copy">
                Invite-code league flow comes after solo-vs-AI proves the
                scoring engine for the rest of the season. Trades + waivers
                stay mock until then.
              </p>
            </div>
            <div className="fantasy-cta-card" style={{ opacity: 0.7 }}>
              <div className="tbl-eyebrow">Create League</div>
              <div className="tbl-display" style={{ fontSize: 28, lineHeight: 1, marginTop: 4 }}>
                8-team commish
              </div>
              <p className="fantasy-cta-card__copy">
                Real 8-team draft room with multi-tab live drafting. Same
                story — unlocks once the scoring loop is solid.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
