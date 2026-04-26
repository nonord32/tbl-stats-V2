// Dark strip above the main nav: season/week label + theme toggle.

import { ThemeToggle } from '@/components/ThemeToggle';

export function TopStrip() {
  return (
    <div className="tbl-top-strip">
      <div className="tbl-top-strip__left">
        <span>2026 Season</span>
        <span>·</span>
        <span>Team Boxing League</span>
      </div>
      <div className="tbl-top-strip__right">
        <span className="tbl-top-strip__timestamp">The Official Record</span>
        <ThemeToggle />
      </div>
    </div>
  );
}
