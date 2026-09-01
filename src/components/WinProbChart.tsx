// src/components/WinProbChart.tsx
// Server-rendered win-probability line chart for a match: team 1's chance of
// winning from round 0 (50%) through the final scheduled round. Pure inline
// SVG in the gazette palette — no chart library, no client JS.

import type { MatchWpa } from '@/lib/wpa';

const W = 720;
const H = 240;
const PAD = { top: 18, right: 16, bottom: 26, left: 44 };

export function WinProbChart({
  wpa,
  team1Label,
  team2Label,
}: {
  wpa: MatchWpa;
  team1Label: string;
  team2Label: string;
}) {
  const { rounds, scheduledRounds } = wpa;
  if (rounds.length === 0) return null;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + (t / scheduledRounds) * plotW;
  const y = (p: number) => PAD.top + (1 - p) * plotH;

  // Points: round 0 at the pre-match 50%, then each round's post-round WP.
  const pts: [number, number][] = [[x(0), y(rounds[0].wpBefore)]];
  for (const r of rounds) pts.push([x(r.round), y(r.wpAfter)]);
  const line = pts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' ');

  const final = rounds[rounds.length - 1];
  const gridP = [0, 0.25, 0.5, 0.75, 1];
  const roundTicks = [0, ...Array.from({ length: Math.floor(scheduledRounds / 4) }, (_, i) => (i + 1) * 4)]
    .filter((t) => t <= scheduledRounds);
  if (!roundTicks.includes(scheduledRounds)) roundTicks.push(scheduledRounds);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Win probability by round: ${team1Label} vs ${team2Label}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      {/* horizontal gridlines + % labels */}
      {gridP.map((p) => (
        <g key={p}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(p)}
            y2={y(p)}
            stroke={p === 0.5 ? 'var(--tbl-ink-soft)' : 'rgba(20,17,11,0.18)'}
            strokeWidth={p === 0.5 ? 1 : 0.75}
            strokeDasharray={p === 0.5 ? '4 4' : undefined}
          />
          <text
            x={PAD.left - 8}
            y={y(p) + 3}
            textAnchor="end"
            style={{ fontFamily: 'var(--tbl-font-mono)', fontSize: 9, fill: 'var(--tbl-ink-soft)' }}
          >
            {(p * 100).toFixed(0)}%
          </text>
        </g>
      ))}

      {/* round ticks */}
      {roundTicks.map((t) => (
        <g key={t}>
          <line
            x1={x(t)}
            x2={x(t)}
            y1={H - PAD.bottom}
            y2={H - PAD.bottom + 4}
            stroke="var(--tbl-ink-soft)"
            strokeWidth={1}
          />
          <text
            x={x(t)}
            y={H - PAD.bottom + 15}
            textAnchor="middle"
            style={{ fontFamily: 'var(--tbl-font-mono)', fontSize: 9, fill: 'var(--tbl-ink-soft)' }}
          >
            {t === 0 ? 'R0' : `R${t}`}
          </text>
        </g>
      ))}

      {/* frame */}
      <rect
        x={PAD.left}
        y={PAD.top}
        width={plotW}
        height={plotH}
        fill="none"
        stroke="var(--tbl-ink)"
        strokeWidth={1.5}
      />

      {/* side labels: team1 owns the top half, team2 the bottom */}
      <text
        x={PAD.left + 6}
        y={PAD.top + 12}
        style={{ fontFamily: 'var(--tbl-font-mono)', fontSize: 9, letterSpacing: '0.16em', fill: 'var(--tbl-ink-soft)', textTransform: 'uppercase' as const }}
      >
        {team1Label.toUpperCase()} WINNING
      </text>
      <text
        x={PAD.left + 6}
        y={H - PAD.bottom - 6}
        style={{ fontFamily: 'var(--tbl-font-mono)', fontSize: 9, letterSpacing: '0.16em', fill: 'var(--tbl-ink-soft)', textTransform: 'uppercase' as const }}
      >
        {team2Label.toUpperCase()} WINNING
      </text>

      {/* the win-probability line */}
      <polyline
        points={line}
        fill="none"
        stroke="var(--tbl-accent)"
        strokeWidth={2.25}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* endpoint dot */}
      <circle cx={x(final.round)} cy={y(final.wpAfter)} r={3.5} fill="var(--tbl-accent)" />
    </svg>
  );
}
