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

function hideChromeFor(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === '/fantasy' || pathname.startsWith('/fantasy/');
}

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hide = hideChromeFor(pathname);
  return (
    <>
      {!hide && <TopStrip />}
      {!hide && <TopNav />}
      <main>{children}</main>
      {!hide && <GazetteFooter />}
      {!hide && <MobileTabBar />}
    </>
  );
}
