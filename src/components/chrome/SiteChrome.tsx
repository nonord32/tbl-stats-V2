'use client';
// Wraps the global TBL chrome (top strip, top nav, footer, mobile tab bar)
// and conditionally hides it on routes that should feel like their own
// product — /fantasy/* renders as a standalone fantasy app, no TBL Stats
// branding around it.
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { TopStrip } from './TopStrip';
import { TopNav } from './TopNav';
import { MobileTabBar } from './MobileTabBar';
import { GazetteFooter } from './GazetteFooter';
import { HomeHeader } from './HomeHeader';

function hideChromeFor(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === '/8-0') return true; // standalone dark game
  return pathname === '/fantasy' || pathname.startsWith('/fantasy/');
}

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hide = hideChromeFor(pathname);
  // The home page swaps the masthead for a floating header over its dark hero.
  const isHome = pathname === '/';
  return (
    <>
      {isHome && <HomeHeader />}
      {!hide && !isHome && <TopStrip />}
      {!hide && !isHome && <TopNav />}
      <main className={isHome ? 'is-full-bleed' : undefined}>{children}</main>
      {!hide && <GazetteFooter />}
      {!hide && <MobileTabBar />}
    </>
  );
}
