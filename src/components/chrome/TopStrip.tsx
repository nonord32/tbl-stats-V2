// Dark strip above the main nav: season/week label + live score + timestamp.
// Live score + timestamp are placeholders for now — data hookup is future work.

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
      </div>
    </div>
  );
}
