// src/components/chrome/GazetteFooter.tsx
// The footer is the site index. It carries the pages the top nav has no room
// for — every advanced stat and its explainer — so they are one click from
// anywhere on any device. Before this they were reachable only from a single
// card grid on the homepage.
import Link from 'next/link';

const COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: 'The League',
    links: [
      { label: 'Fighters', href: '/fighters' },
      { label: 'Standings', href: '/teams' },
      { label: 'Schedule', href: '/schedule' },
      { label: 'Results', href: '/results' },
      { label: 'Playoffs', href: '/playoffs' },
      { label: 'Awards', href: '/awards' },
    ],
  },
  {
    heading: 'Advanced Stats',
    links: [
      { label: 'Biggest Rounds', href: '/advanced?view=rounds' },
      { label: 'Fighter Leaderboard', href: '/advanced?view=fighters' },
      { label: 'Biggest Comebacks', href: '/advanced?view=matches' },
    ],
  },
  {
    heading: 'Reference',
    links: [
      { label: 'How the Stats Work', href: '/stats' },
      { label: 'Every Stat Defined', href: '/stats#glossary' },
    ],
  },
];

export function GazetteFooter() {
  return (
    <footer className="tbl-footer-wrap">
      <div className="tbl-footer-cols">
        {COLUMNS.map((col) => (
          <div key={col.heading} className="tbl-footer-col">
            <div className="tbl-footer-col__heading">{col.heading}</div>
            <ul className="tbl-footer-col__list">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="tbl-footer-col__link">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="tbl-footer">
        <span>© 2026 TBL Stats · teamboxingleague.com · @teamboxingleague</span>
        <span>Data refreshes every 5 minutes</span>
      </div>
    </footer>
  );
}
