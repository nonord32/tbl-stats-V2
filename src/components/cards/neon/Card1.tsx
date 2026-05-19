// src/components/cards/neon/Card1.tsx
'use client';
import React from 'react';
import { NeonFrame } from './Frame';
import { N, nSans, nMono } from './tokens';
import type { Card1Data } from '../shared';

export default function NeonCard1({ data }: { data: Card1Data }) {
  const [top, ...rest] = data.fighters;
  if (!top) {
    return (
      <NeonFrame
        title={`Week ${data.week} Top Performers`}
        badge={`WK ${data.week}`}
        glowColor={N.pink}
      >
        <div style={{ fontFamily: nMono, fontSize: 11, color: N.textDim }}>
          No fighters this week.
        </div>
      </NeonFrame>
    );
  }
  return (
    <NeonFrame
      title={`Week ${data.week} Top Performers`}
      badge={`WK ${data.week}`}
      glowColor={N.pink}
    >
      <div
        style={{
          padding: '10px 12px',
          borderRadius: 12,
          marginBottom: 6,
          background: `linear-gradient(135deg, ${N.pink}, ${N.cyan})`,
          color: N.bg,
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          gap: 10,
          alignItems: 'center',
        }}
      >
        <div
          style={{
            fontFamily: nSans,
            fontWeight: 800,
            fontSize: 26,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          01
        </div>
        <div>
          <div
            style={{
              fontFamily: nSans,
              fontWeight: 800,
              fontSize: 17,
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}
          >
            {top.name}
          </div>
          <div
            style={{
              fontFamily: nMono,
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: '0.14em',
              marginTop: 3,
            }}
          >
            {top.team} · {top.method}
          </div>
        </div>
        <div
          style={{
            fontFamily: nSans,
            fontWeight: 800,
            fontSize: 24,
            lineHeight: 1,
            letterSpacing: '-0.03em',
          }}
        >
          {top.pts}
        </div>
      </div>
      {rest.map((f, i) => (
        <div
          key={`${f.name}-${i}`}
          style={{
            display: 'grid',
            gridTemplateColumns: '26px 1fr auto auto',
            gap: 8,
            alignItems: 'center',
            padding: '6px 4px',
            borderBottom:
              i === rest.length - 1 ? 'none' : `1px solid ${N.surface2}`,
          }}
        >
          <div
            style={{
              fontFamily: nSans,
              fontWeight: 700,
              fontSize: 14,
              color: N.textMute,
            }}
          >
            {String(i + 2).padStart(2, '0')}
          </div>
          <div>
            <div style={{ fontFamily: nSans, fontWeight: 600, fontSize: 14, lineHeight: 1 }}>
              {f.name}
            </div>
            <div
              style={{
                fontFamily: nMono,
                fontSize: 8.5,
                color: N.textDim,
                letterSpacing: '0.12em',
                marginTop: 2,
              }}
            >
              {f.team}
            </div>
          </div>
          <div
            style={{
              fontFamily: nMono,
              fontSize: 8.5,
              color: N.pink,
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 999,
              background: `${N.pink}14`,
              border: `1px solid ${N.pink}30`,
              letterSpacing: '0.1em',
            }}
          >
            {f.method}
          </div>
          <div
            style={{
              fontFamily: nSans,
              fontWeight: 700,
              fontSize: 18,
              color: N.text,
              minWidth: 54,
              textAlign: 'right',
              letterSpacing: '-0.02em',
            }}
          >
            {f.pts}
          </div>
        </div>
      ))}
    </NeonFrame>
  );
}
