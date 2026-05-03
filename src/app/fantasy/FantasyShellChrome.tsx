'use client';
// Client wrapper that decides whether to render the fantasy banner +
// sub-nav. Hidden on the login surface so /fantasy/login feels like a
// standalone auth page (no nav around the form).
import { usePathname } from 'next/navigation';
import { FantasySubNav } from './FantasySubNav';

export function FantasyShellChrome() {
  const pathname = usePathname();
  if (pathname === '/fantasy/login') return null;

  return (
    <>
      <div className="fv2-banner">
        <div className="fv2-banner__brand">
          <span className="fv2-banner__eyebrow">Fantasy Boxing</span>
          <span className="fv2-banner__title">Team Boxing League · 2026</span>
        </div>
        <span className="fv2-banner__badge">Beta</span>
      </div>
      <FantasySubNav />
    </>
  );
}
