// src/components/cards/neon/Card4.tsx
'use client';
import React from 'react';
import { NeonFrame } from './Frame';
import { N, nSans, nMono } from './tokens';
import type { Card4Data, Card4Side } from '../shared';

function Side({
  f,
  align,
  accent,
}: {
  f: Card4Side;
  align: 'left' | 'right';
  accent: string;
}) {
  const first = f.name.split(' ')[0];
  const last = f.name.split(' ').slice(1).join(' ');
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: align === 'right' ? 'flex-end' : 'flex-start',
      }}
    >
      <div
        style={{
          fontFamily: nMono,
          fontSize: 9,
          letterSpacing: '0.16em',
          fontWeight: 700,
          padding: '3px 8px',
          borderRadius: 999,
          background: `${accent}14`,
          border: `1px solid ${accent}40`,
          color: accent,
        }}
      >
        {f.team.split(' ')[0]}
      </div>
      <div
        style={{
          fontFamily: nSans,
          fontWeight: 800,
          fontSize: 26,
          lineHeight: 1,
          letterSpacing: '-0.03em',
          marginTop: 8,
          textAlign: align,
        }}
      >
        {first}
      </div>
      {last && (
        <div
          style={{
            fontFamily: nSans,
            fontWeight: 800,
            fontSize: 26,
            lineHeight: 1,
            letterSpacing: '-0.03em',
            textAlign: align,
          }}
        >
          {last}
        </div>
      )}
      <div
        style={{
          fontFamily: nMono,
          fontSize: 10,
          color: N.textDim,
          letterSpacing: '0.14em',
          fontWeight: 600,
          marginTop: 6,
        }}
      >
        {f.record}
      </div>
    </div>
  );
}

function Dots({ last3, align }: { last3: ('w' | 'l')[]; align: 'left' | 'right' }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
      }}
    >
      {last3.map((r, i) => (
        <div
          key={i}
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: r === 'w' ? N.green : N.red,
          }}
        />
      ))}
    </div>
  );
}

export default function NeonCard4({ data }: { data: Card4Data }) {
  const { a, b } = data;
  const rows = [
    {
      label: 'NET PTS',
      av: `${a.netPts >= 0 ? '+' : ''}${a.netPts}`,
      bv: `${b.netPts >= 0 ? '+' : ''}${b.netPts}`,
      aBetter: a.netPts > b.netPts,
    },
    {
      label: 'ROUND WIN%',
      av: `${a.roundWinPct}%`,
      bv: `${b.roundWinPct}%`,
      aBetter: a.roundWinPct > b.roundWinPct,
    },
  ];
  return (
    <NeonFrame title={`Tale Of The Tape · Wk ${data.week}`} badge="VS" glowColor={N.pink}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <Side f={a} align="left" accent={N.pink} />
        <div
          style={{
            fontFamily: nSans,
            fontWeight: 800,
            fontSize: 30,
            lineHeight: 1,
            background: `linear-gradient(135deg, ${N.pink}, ${N.cyan})`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            letterSpacing: '-0.02em',
          }}
        >
          VS
        </div>
        <Side f={b} align="right" accent={N.cyan} />
      </div>
      {rows.map((row) => (
        <div
          key={row.label}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 90px 1fr',
            alignItems: 'center',
            padding: '5px 0',
            borderTop: `1px solid ${N.line}`,
          }}
        >
          <div
            style={{
              fontFamily: nSans,
              fontWeight: 700,
              fontSize: 19,
              color: row.aBetter ? N.pink : N.text,
              textAlign: 'right',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            {row.av}
          </div>
          <div
            style={{
              fontFamily: nMono,
              fontSize: 9,
              color: N.textMute,
              letterSpacing: '0.18em',
              fontWeight: 700,
              textAlign: 'center',
            }}
          >
            {row.label}
          </div>
          <div
            style={{
              fontFamily: nSans,
              fontWeight: 700,
              fontSize: 19,
              color: !row.aBetter ? N.cyan : N.text,
              textAlign: 'left',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            {row.bv}
          </div>
        </div>
      ))}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 90px 1fr',
          alignItems: 'center',
          padding: '5px 0',
          borderTop: `1px solid ${N.line}`,
        }}
      >
        <Dots last3={a.last3} align="right" />
        <div
          style={{
            fontFamily: nMono,
            fontSize: 9,
            color: N.textMute,
            letterSpacing: '0.18em',
            fontWeight: 700,
            textAlign: 'center',
          }}
        >
          LAST 3
        </div>
        <Dots last3={b.last3} align="left" />
      </div>
    </NeonFrame>
  );
}
