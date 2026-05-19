// src/components/cards/gazette/Card2.tsx
'use client';
import React from 'react';
import { GazetteFrame } from './Frame';
import { G, gSerif, gMono } from './tokens';
import type { Card2Data } from '../shared';

export default function GazetteCard2({ data }: { data: Card2Data }) {
  const ranked = [...data.fighters]
    .map((f) => ({ ...f, total: f.pts.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total);
  const maxAbs = Math.max(1, ...ranked.flatMap((f) => f.pts.map(Math.abs)));
  return (
    <GazetteFrame title="Net Points · Last 5 Rounds" badge="ROLLING">
      {ranked.map((f, i) => {
        return (
          <div
            key={`${f.name}-${i}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '22px 1fr 72px auto',
              gap: 8,
              alignItems: 'center',
              padding: '5px 0',
              borderBottom:
                i === ranked.length - 1 ? 'none' : '1px dotted rgba(20,17,11,0.3)',
            }}
          >
            <div
              style={{
                fontFamily: gSerif,
                fontWeight: 900,
                fontSize: 16,
                color: i === 0 ? G.accent : G.inkSoft,
              }}
            >
              {i + 1}.
            </div>
            <div>
              <div style={{ fontFamily: gSerif, fontWeight: 700, fontSize: 14, lineHeight: 1.05 }}>
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
                        background: G.ink,
                        opacity: 0.3,
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        height: h,
                        background: v >= 0 ? G.accent : G.red,
                        top: v >= 0 ? `calc(50% - ${h}px)` : '50%',
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div
              style={{
                fontFamily: gSerif,
                fontWeight: 800,
                fontSize: 16,
                minWidth: 44,
                textAlign: 'right',
              }}
            >
              {Math.round(f.total) > 0 ? '+' : ''}
              {Math.round(f.total)}
            </div>
          </div>
        );
      })}
    </GazetteFrame>
  );
}
