'use client';
// Client wrapper that decides whether to render the fantasy banner +
// sub-nav. Hidden on auth surfaces (login / signup / forgot-password /
// reset-password) so those feel like standalone pages, not tabs.
import { usePathname } from 'next/navigation';
import { FantasySubNav } from './FantasySubNav';

const AUTH_PATHS = new Set([
  '/fantasy/login',
  '/fantasy/signup',
  '/fantasy/forgot-password',
  '/fantasy/reset-password',
]);

export function FantasyShellChrome() {
  const pathname = usePathname();
  if (pathname && AUTH_PATHS.has(pathname)) return null;

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
