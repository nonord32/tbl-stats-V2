// src/app/fantasy/layout.tsx
// v2 dark shell for the Fantasy section. Wraps every fantasy page in
// `.fv2` so dark-mode tokens apply. The banner + sub-nav are conditional
// (rendered via FantasyShellChrome) — hidden on /fantasy/login so the
// auth page feels standalone.
import type { ReactNode } from 'react';
import { FantasyShellChrome } from './FantasyShellChrome';

export const metadata = {
  title: 'Fantasy Boxing — TBL Stats',
};

export default function FantasyLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fv2">
      <FantasyShellChrome />
      {children}
    </div>
  );
}
