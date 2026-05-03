'use client';
// Lobby league/team picker. With one league it renders a static chip
// showing the team name. With 2+ it renders a dropdown that switches
// the lobby's active team. Multi-league wiring (per-team summaries,
// state hoisting) lands when real leagues ship in Stage 1.
import { useState } from 'react';

export interface MyLeague {
  id: string;
  label: string;     // league type label, e.g. "Solo · vs AI"
  teamName: string;  // the user's team in that league
}

interface Props {
  leagues: MyLeague[];
  initialId: string;
}

export function LobbyLeaguePicker({ leagues, initialId }: Props) {
  const [activeId, setActiveId] = useState(initialId);
  const active = leagues.find((l) => l.id === activeId) ?? leagues[0];
  if (!active) return null;

  const single = leagues.length === 1;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--fv2-font-mono)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--fv2-text-3)',
        }}
      >
        League
      </span>
      {single ? (
        <span
          className="fv2-badge"
          title="You're in one league"
          style={{ cursor: 'default' }}
        >
          {active.label} · {active.teamName}
        </span>
      ) : (
        <select
          className="fv2-select"
          value={activeId}
          onChange={(e) => setActiveId(e.target.value)}
          style={{ fontSize: 12, padding: '6px 10px', minWidth: 240 }}
          aria-label="Filter by league"
        >
          {leagues.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label} · {l.teamName}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
