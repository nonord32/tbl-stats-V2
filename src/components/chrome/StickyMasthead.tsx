'use client';
// Slim fixed masthead that slides in once the full TopNav has scrolled out of
// view, so the logo and nav stay one glance away on long pages. Desktop only:
// below 1024px the mobile tab bar already anchors navigation (see globals.css).
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NAV_LINKS, isActive } from './TopNav';

export function StickyMasthead() {
  const pathname = usePathname() || '/';
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const nav = document.querySelector('.tbl-top-nav');
    if (!nav) return;
    const update = () => setShown(nav.getBoundingClientRect().bottom < 0);
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [pathname]);

  return (
    <div
      className={`tbl-sticky-mast${shown ? ' is-shown' : ''}`}
      aria-hidden={!shown}
    >
      {/* While hidden, tabIndex -1 keeps this copy of the nav out of the tab order. */}
      <Link href="/" tabIndex={shown ? undefined : -1} className="tbl-sticky-mast__brand" aria-label="TBL Stats — home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/tbl-logo.png" alt="" className="tbl-sticky-mast__logo" />
        <span className="tbl-sticky-mast__wordmark">TBL Stats</span>
      </Link>
      <nav className="tbl-sticky-mast__links" aria-label="Primary (compact)">
        {NAV_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            tabIndex={shown ? undefined : -1}
            className={`tbl-sticky-mast__link${isActive(pathname, l.href) ? ' is-active' : ''}`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
