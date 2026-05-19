// src/components/cards/neon/Card3.tsx
'use client';
import React from 'react';
import { NeonFrame } from './Frame';
import { N, nSans, nMono } from './tokens';
import type { Card3Data } from '../shared';

export default function NeonCard3({ data }: { data: Card3Data }) {
  const ranked = [...data.fighters].sort((a, b) => b.finishRate - a.finishRate);
  const max = ranked[0]?.finishRate || 1;
  return (
    <NeonFrame title="Finish Rate Leaders" badge="KO+TKO" glowColor={N.yellow}>
      {ranked.map((f, i) => {
        const pct = Math.round(f.finishRate * 100);
        const barW = max > 0 ? (f.finishRate / max) * 100 : 0;
        return (
          <div
            key={`${f.name}-${i}`}
            style={{
              padding: '5px 8px',
              borderRadius: 8,
              background: i === 0 ? N.surface : 'transparent',
              borderLeft: i === 0 ? `2px solid ${N.yellow}` : '2px solid transparent',
              marginBottom: 2,
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
                  fontFamily: nSans,
                  fontWeight: 700,
                  fontSize: 14,
                  color: i === 0 ? N.yellow : N.textMute,
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
                  {f.team} · {f.totalFights} FIGHTS
                </div>
              </div>
              <div
                style={{
                  fontFamily: nSans,
                  fontWeight: 800,
                  fontSize: 20,
                  color: i === 0 ? N.yellow : N.text,
                  lineHeight: 1,
                  letterSpacing: '-0.025em',
                }}
              >
                {pct}%
              </div>
            </div>
            <div
              style={{
                marginTop: 4,
                height: 3,
                background: N.surface2,
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${barW}%`,
                  background:
                    i === 0
                      ? `linear-gradient(90deg, ${N.yellow}, ${N.pink})`
                      : N.textMute,
                }}
              />
            </div>
          </div>
        );
      })}
    </NeonFrame>
  );
}
