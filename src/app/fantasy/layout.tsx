// src/app/fantasy/layout.tsx
// Shared chrome for the Fantasy preview: sub-nav + Dev Preview badge.
// Pages render inside <main> from the root layout; this just adds the
// fantasy-specific banner and tab strip on top.
import type { ReactNode } from 'react';
import { FantasySubNav } from './FantasySubNav';

export const metadata = {
  title: 'Fantasy Boxing — TBL Stats',
};

export default function FantasyLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="fantasy-banner">
        <div>
          <span className="fantasy-banner__eyebrow">Fantasy Boxing</span>
          <span className="fantasy-banner__title">Team Boxing League · Mock League 1</span>
        </div>
        <span className="fantasy-banner__badge">Dev Preview</span>
      </div>
      <FantasySubNav />
      {children}
    </>
  );
}
