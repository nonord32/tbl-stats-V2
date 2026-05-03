// src/app/fantasy/layout.tsx
// v2 dark shell for the Fantasy section. Wraps every fantasy page in
// `.fv2` so dark-mode tokens apply, then renders the v2 banner + sub-nav
// at the top. Unmigrated pages still render their .fantasy-* content
// inside this shell (looks half-migrated until Phase B finishes them).
import type { ReactNode } from 'react';
import { FantasySubNav } from './FantasySubNav';

export const metadata = {
  title: 'Fantasy Boxing — TBL Stats',
};

export default function FantasyLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fv2">
      <div className="fv2-banner">
        <div className="fv2-banner__brand">
          <span className="fv2-banner__eyebrow">Fantasy Boxing</span>
          <span className="fv2-banner__title">Team Boxing League · 2026</span>
        </div>
        <span className="fv2-banner__badge">Beta</span>
      </div>
      <FantasySubNav />
      {children}
    </div>
  );
}
