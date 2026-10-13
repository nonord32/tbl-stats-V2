// Floating header used on the home page only, in place of TopStrip + TopNav.
// A rounded white bar that sits over the dark hero, with one primary button.
// Below 1024px the links drop out and the mobile tab bar takes over.
import Link from 'next/link';

const LINKS: { label: string; href: string }[] = [
  { label: 'Standings', href: '/teams' },
  { label: 'Playoffs', href: '/playoffs' },
  { label: 'Schedule', href: '/schedule' },
  { label: 'Bracket', href: '/bracket' },
  { label: 'Leaderboard', href: '/leaderboard' },
];

export function HomeHeader() {
  return (
    <header className="hm-header">
      <Link href="/" className="hm-header__brand" aria-label="TBL Stats — home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/tbl-logo.png" alt="" className="hm-header__logo" />
        <span className="hm-header__wordmark">TBL Stats</span>
      </Link>
      <nav className="hm-header__links" aria-label="Primary">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="hm-header__link">
            {l.label}
          </Link>
        ))}
      </nav>
      <Link href="/fighters" className="hm-btn">
        Explore stats
      </Link>
    </header>
  );
}
