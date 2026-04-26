// src/app/fantasy/page.tsx
// Lobby — entry point for fantasy. Shows the user's team summary, league
// standings, and league join/create CTAs. All mock data, no Supabase.
import Link from 'next/link';
import { ME, STANDINGS } from '@/lib/fantasyMock';

export const dynamic = 'force-dynamic';

export default function FantasyLobbyPage() {
  return (
    <>
      {/* Dark hero with my team's headline */}
      <div className="fantasy-hero">
        <div>
          <div className="tbl-eyebrow" style={{ color: 'var(--tbl-accent-bright)' }}>
            Welcome back · {ME.user.displayName}
          </div>
          <div className="tbl-display fantasy-hero__title">{ME.team.name}</div>
          <div className="fantasy-hero__sub">
            {ME.team.record} · #{ME.team.rank} of {STANDINGS.length} ·{' '}
            {ME.team.totalPoints.toFixed(1)} PF
          </div>
        </div>
        <div className="fantasy-hero__actions">
          <Link href="/fantasy/team" className="fantasy-btn fantasy-btn--primary">
            Set lineup →
          </Link>
          <Link href="/fantasy/scoring" className="fantasy-btn fantasy-btn--ghost">
            Last week
          </Link>
        </div>
      </div>

      <div className="fantasy-body">
        {/* CTAs */}
        <section className="fantasy-section">
          <div className="tbl-section-rule">
            <span>Leagues</span>
            <span>Mock data</span>
          </div>
          <div className="fantasy-cta-grid">
            <div className="fantasy-cta-card">
              <div className="tbl-eyebrow">Join League</div>
              <div
                className="tbl-display"
                style={{ fontSize: 28, lineHeight: 1, marginTop: 4 }}
              >
                Got an invite code?
              </div>
              <p className="fantasy-cta-card__copy">
                Drop the 6-char code from your league commish and you&apos;ll
                land in their draft room.
              </p>
              <div className="fantasy-cta-card__row">
                <input
                  className="fantasy-input"
                  placeholder="A4XK-7Z"
                  aria-label="Invite code"
                />
                <button className="fantasy-btn fantasy-btn--primary" type="button">
                  Join
                </button>
              </div>
            </div>
            <div className="fantasy-cta-card">
              <div className="tbl-eyebrow">Create League</div>
              <div
                className="tbl-display"
                style={{ fontSize: 28, lineHeight: 1, marginTop: 4 }}
              >
                Start your own
              </div>
              <p className="fantasy-cta-card__copy">
                10 teams, snake draft, 7-fighter lineups, head-to-head weekly.
                You can tweak settings before the draft.
              </p>
              <div className="fantasy-cta-card__row">
                <button className="fantasy-btn fantasy-btn--primary" type="button">
                  Create league →
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Quick links */}
        <section className="fantasy-section">
          <div className="tbl-section-rule">
            <span>Quick actions</span>
          </div>
          <div className="fantasy-quick-grid">
            {[
              { href: '/fantasy/draft',   eyebrow: 'On the clock', title: 'Draft', sub: 'Round 3 · Pick 27 — your turn' },
              { href: '/fantasy/waiver',  eyebrow: '2 free agents', title: 'Waiver', sub: 'Process Wed 3am ET' },
              { href: '/fantasy/trades',  eyebrow: '2 active offers', title: 'Trades', sub: '1 incoming · 1 outgoing' },
              { href: '/fantasy/scoring', eyebrow: 'Last week', title: 'Scoring', sub: 'You 11 — 9 Headgear Heroes (W)' },
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

        {/* Leaderboard */}
        <section className="fantasy-section">
          <div className="tbl-section-rule">
            <span>Season Standings</span>
            <span>Sorted by Wins</span>
          </div>
          <div className="fantasy-table-wrap">
            <table className="fantasy-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Team</th>
                  <th>Owner</th>
                  <th className="num">W-L</th>
                  <th className="num">PF</th>
                  <th className="num">PA</th>
                  <th className="num">Strk</th>
                </tr>
              </thead>
              <tbody>
                {STANDINGS.map((s) => (
                  <tr key={s.team} className={s.isYou ? 'is-you' : undefined}>
                    <td>{s.rank}</td>
                    <td>
                      <span className="fantasy-table__team">{s.team}</span>
                      {s.isYou && <span className="fantasy-pill">YOU</span>}
                    </td>
                    <td className="muted">@{s.owner}</td>
                    <td className="num mono">{s.record}</td>
                    <td className="num mono">{s.pf.toFixed(1)}</td>
                    <td className="num mono">{s.pa.toFixed(1)}</td>
                    <td
                      className="num mono"
                      style={{
                        color: s.streak.startsWith('W') ? 'var(--tbl-green)' : 'var(--tbl-red)',
                        fontWeight: 700,
                      }}
                    >
                      {s.streak}
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
