// src/components/cards/gazette/Card3.tsx
'use client';
import React from 'react';
import { GazetteFrame } from './Frame';
import { G, gSerif, gMono } from './tokens';
import type { Card3Data } from '../shared';

export default function GazetteCard3({ data }: { data: Card3Data }) {
  const ranked = [...data.fighters].sort((a, b) => b.finishRate - a.finishRate);
  const max = ranked[0]?.finishRate || 1;
  return (
    <GazetteFrame title="Finish Rate Leaders" badge="KO + TKO ÷ WINS">
      {ranked.map((f, i) => {
        const pct = Math.round(f.finishRate * 100);
        const barW = max > 0 ? (f.finishRate / max) * 100 : 0;
        return (
          <div
            key={`${f.name}-${i}`}
            style={{
              padding: '4px 0',
              borderBottom:
                i === ranked.length - 1 ? 'none' : '1px dotted rgba(20,17,11,0.3)',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '22px 1fr auto',
                gap: 8,
                alignItems: 'center',
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
                  {f.team} · {f.totalFights} FIGHTS
                </div>
              </div>
              <div
                style={{
                  fontFamily: gSerif,
                  fontWeight: 900,
                  fontSize: 20,
                  color: i === 0 ? G.accent : G.ink,
                  lineHeight: 1,
                  letterSpacing: '-0.01em',
                }}
              >
                {pct}%
              </div>
            </div>
            <div
              style={{
                marginTop: 3,
                height: 3,
                background: 'rgba(20,17,11,0.15)',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${barW}%`,
                  background: i === 0 ? G.accent : G.ink,
                }}
              />
            </div>
          </div>
        );
      })}
    </GazetteFrame>
  );
}
