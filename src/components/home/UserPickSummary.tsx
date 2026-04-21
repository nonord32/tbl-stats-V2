// src/components/home/UserPickSummary.tsx
// Auth-aware strip on the homepage: shows the user's pick status for the
// current week and points earned last week, or a sign-in CTA when logged out.

import Link from 'next/link';

interface Props {
  isSignedIn: boolean;
  currentWeek: number | null;
  lastWeek: number | null;
  openMatchCount: number;
  picksThisWeekCount: number;
  pointsLastWeek: number | null;
}

export function UserPickSummary({
  isSignedIn,
  currentWeek,
  lastWeek,
  openMatchCount,
  picksThisWeekCount,
  pointsLastWeek,
}: Props) {
  let title: string;
  let subtitle: string | null = null;
  let ctaLabel: string;
  let ctaHref: string;

  if (!isSignedIn) {
    title = 'Play Pick’em';
    subtitle =
      'Sign in to predict winners, earn points, and climb the leaderboard.';
    ctaLabel = 'Sign in →';
    ctaHref = '/login';
  } else if (currentWeek === null) {
    title = 'Off-week';
    subtitle =
      lastWeek !== null && pointsLastWeek !== null
        ? `You earned ${pointsLastWeek} pt${pointsLastWeek === 1 ? '' : 's'} last week.`
        : 'No matches open right now — check back soon.';
    ctaLabel = 'View leaderboard →';
    ctaHref = '/leaderboard';
  } else if (picksThisWeekCount === 0 && openMatchCount > 0) {
    title = `You haven’t picked Week ${currentWeek} yet`;
    subtitle = `${openMatchCount} match${openMatchCount === 1 ? '' : 'es'} still open.`;
    ctaLabel = 'Make picks →';
    ctaHref = '/picks';
  } else if (openMatchCount > 0) {
    title = `${picksThisWeekCount} pick${picksThisWeekCount === 1 ? '' : 's'} in for Week ${currentWeek}`;
    subtitle = `${openMatchCount} match${openMatchCount === 1 ? '' : 'es'} still open.`;
    ctaLabel = 'Finish picks →';
    ctaHref = '/picks';
  } else {
    title = `All Week ${currentWeek} picks locked in`;
    subtitle =
      picksThisWeekCount > 0
        ? `You submitted ${picksThisWeekCount} pick${picksThisWeekCount === 1 ? '' : 's'}.`
        : 'Picks are closed for this week.';
    ctaLabel = 'View leaderboard →';
    ctaHref = '/leaderboard';
  }

  const lastWeekLine =
    isSignedIn && lastWeek !== null && pointsLastWeek !== null && currentWeek !== null
      ? `Week ${lastWeek}: ${pointsLastWeek} pt${pointsLastWeek === 1 ? '' : 's'} earned`
      : null;

  return (
    <section style={{ padding: '12px 0 0' }}>
      <div className="container">
        <div className="home-user-strip">
          <div className="home-user-strip__text">
            <span className="home-user-strip__title">{title}</span>
            {subtitle && (
              <span className="home-user-strip__subtitle">{subtitle}</span>
            )}
          </div>
          <div className="home-user-strip__actions">
            {lastWeekLine && (
              <Link href="/leaderboard" className="home-user-strip__last">
                {lastWeekLine}
              </Link>
            )}
            <Link href={ctaHref} className="home-user-strip__cta">
              {ctaLabel}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
