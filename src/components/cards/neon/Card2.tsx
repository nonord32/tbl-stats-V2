// src/components/cards/neon/Card2.tsx
'use client';
import React from 'react';
import { NeonFrame } from './Frame';
import { N, nSans, nMono } from './tokens';
import type { Card2Data } from '../shared';

export default function NeonCard2({ data }: { data: Card2Data }) {
  const ranked = [...data.fighters]
    .map((f) => ({ ...f, total: f.pts.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total);
  const maxAbs = Math.max(1, ...ranked.flatMap((f) => f.pts.map(Math.abs)));
  return (
    <NeonFrame title="Net Points · Last 5 Rounds" badge="ROLLING" glowColor={N.cyan}>
      {ranked.map((f, i) => {
        return (
          <div
            key={`${f.name}-${i}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '22px 1fr 72px auto',
              gap: 8,
              alignItems: 'center',
              padding: '6px 6px',
              borderRadius: 8,
              background: i === 0 ? N.surface : 'transparent',
              borderLeft: i === 0 ? `2px solid ${N.pink}` : '2px solid transparent',
              marginBottom: i === 0 ? 4 : 0,
            }}
          >
            <div
              style={{
                fontFamily: nSans,
                fontWeight: 700,
                fontSize: 14,
                color: i === 0 ? N.pink : N.textMute,
              }}
            >
              {i + 1}
            </div>
            <div>
              <div style={{ fontFamily: nSans, fontWeight: 600, fontSize: 13.5, lineHeight: 1 }}>
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
            <div style={{ height: 24, display: 'flex', alignItems: 'center', gap: 2 }}>
              {f.pts.map((v, j) => {
                const h = Math.max(2, (Math.abs(v) / maxAbs) * 11);
                return (
                  <div key={j} style={{ width: 11, height: 24, position: 'relative' }}>
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: 0,
                        right: 0,
                        height: 1,
                        background: N.line,
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        height: h,
                        background: v >= 0 ? N.pink : N.red,
                        borderRadius: 1,
                        top: v >= 0 ? `calc(50% - ${h}px)` : '50%',
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div
              style={{
                fontFamily: nSans,
                fontWeight: 700,
                fontSize: 16,
                color: N.text,
                minWidth: 42,
                textAlign: 'right',
                letterSpacing: '-0.02em',
              }}
            >
              {Math.round(f.total) > 0 ? '+' : ''}
              {Math.round(f.total)}
            </div>
          </div>
        );
      })}
    </NeonFrame>
  );
}
