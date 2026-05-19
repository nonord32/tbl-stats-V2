// src/components/cards/gazette/Card1.tsx
'use client';
import React from 'react';
import { GazetteFrame } from './Frame';
import { G, gSerif, gMono } from './tokens';
import type { Card1Data } from '../shared';

export default function GazetteCard1({ data }: { data: Card1Data }) {
  const [top, ...rest] = data.fighters;
  if (!top) {
    return (
      <GazetteFrame
        title={`Week ${data.week} · Top Performers`}
        badge={`WK ${data.week}`}
      >
        <div style={{ fontFamily: gMono, fontSize: 11, color: G.inkSoft }}>
          No fighters this week.
        </div>
      </GazetteFrame>
    );
  }
  return (
    <GazetteFrame
      title={`Week ${data.week} · Top Performers`}
      badge={`WK ${data.week}`}
    >
      <div
        style={{
          background: G.ink,
          color: G.bg,
          padding: '8px 12px',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          gap: 10,
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontFamily: gSerif,
            fontWeight: 900,
            fontSize: 28,
            lineHeight: 1,
            color: G.accent,
          }}
        >
          1.
        </div>
        <div>
          <div style={{ fontFamily: gSerif, fontWeight: 900, fontSize: 18, lineHeight: 1 }}>
            {top.name}
          </div>
          <div
            style={{
              fontFamily: gMono,
              fontSize: 9,
              letterSpacing: '0.16em',
              marginTop: 3,
              color: 'rgba(244,237,224,0.7)',
            }}
          >
            {top.team} · {top.method}
          </div>
        </div>
        <div
          style={{
            fontFamily: gSerif,
            fontWeight: 900,
            fontSize: 26,
            lineHeight: 1,
            color: G.accent,
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
            padding: '5px 0',
            borderBottom:
              i === rest.length - 1 ? 'none' : '1px dotted rgba(20,17,11,0.3)',
          }}
        >
          <div
            style={{
              fontFamily: gSerif,
              fontWeight: 900,
              fontSize: 16,
              color: G.inkSoft,
            }}
          >
            {i + 2}.
          </div>
          <div>
            <div style={{ fontFamily: gSerif, fontWeight: 700, fontSize: 15, lineHeight: 1.05 }}>
              {f.name}
            </div>
            <div
              style={{
                fontFamily: gMono,
                fontSize: 8.5,
                letterSpacing: '0.12em',
                color: G.inkSoft,
                marginTop: 2,
              }}
            >
              {f.team}
            </div>
          </div>
          <div
            style={{
              fontFamily: gMono,
              fontSize: 9,
              color: G.accent,
              fontWeight: 700,
              padding: '2px 5px',
              border: `1px solid ${G.accent}`,
              letterSpacing: '0.1em',
            }}
          >
            {f.method}
          </div>
          <div
            style={{
              fontFamily: gSerif,
              fontWeight: 800,
              fontSize: 18,
              color: G.ink,
              minWidth: 54,
              textAlign: 'right',
            }}
          >
            {f.pts}
          </div>
        </div>
      ))}
    </GazetteFrame>
  );
}
