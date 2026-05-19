// src/components/cards/gazette/Card4.tsx
'use client';
import React from 'react';
import { GazetteFrame } from './Frame';
import { G, gSerif, gMono } from './tokens';
import { teamLogoPath } from '../teamLogo';
import type { Card4Data, Card4Side } from '../shared';

function TeamLogo({ team, size }: { team: string; size: number }) {
  const src = teamLogoPath(team);
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'contain', display: 'block' }}
    />
  );
}

function Side({ f, align }: { f: Card4Side; align: 'left' | 'right' }) {
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
      <TeamLogo team={f.team} size={42} />
      <div
        style={{
          fontFamily: gMono,
          fontSize: 9,
          letterSpacing: '0.18em',
          color: G.accent,
          fontWeight: 700,
          textTransform: 'uppercase',
          marginTop: 6,
        }}
      >
        {f.team}
      </div>
      <div
        style={{
          fontFamily: gSerif,
          fontWeight: 900,
          fontSize: 26,
          lineHeight: 0.95,
          letterSpacing: '-0.01em',
          marginTop: 4,
          textAlign: align,
        }}
      >
        {first}
      </div>
      {last && (
        <div
          style={{
            fontFamily: gSerif,
            fontWeight: 900,
            fontSize: 26,
            lineHeight: 0.95,
            letterSpacing: '-0.01em',
            textAlign: align,
          }}
        >
          {last}
        </div>
      )}
      <div
        style={{
          fontFamily: gMono,
          fontSize: 10,
          color: G.inkSoft,
          letterSpacing: '0.14em',
          fontWeight: 600,
          marginTop: 5,
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
          style={{ width: 10, height: 10, background: r === 'w' ? G.green : G.red }}
        />
      ))}
    </div>
  );
}

export default function GazetteCard4({ data }: { data: Card4Data }) {
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
    <GazetteFrame title={`Week ${data.week} · Tale Of The Tape`} badge="HEAD TO HEAD">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
        }}
      >
        <Side f={a} align="left" />
        <div
          style={{
            fontFamily: gSerif,
            fontWeight: 900,
            fontSize: 38,
            color: G.accent,
            fontStyle: 'italic',
            lineHeight: 1,
          }}
        >
          vs
        </div>
        <Side f={b} align="right" />
      </div>
      {rows.map((row) => (
        <div
          key={row.label}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 90px 1fr',
            alignItems: 'center',
            padding: '4px 0',
            borderTop: `1px solid ${G.ink}`,
          }}
        >
          <div
            style={{
              fontFamily: gSerif,
              fontWeight: 800,
              fontSize: 20,
              color: row.aBetter ? G.accent : G.ink,
              textAlign: 'right',
              lineHeight: 1,
            }}
          >
            {row.av}
          </div>
          <div
            style={{
              fontFamily: gMono,
              fontSize: 9,
              color: G.inkSoft,
              letterSpacing: '0.18em',
              fontWeight: 700,
              textAlign: 'center',
            }}
          >
            {row.label}
          </div>
          <div
            style={{
              fontFamily: gSerif,
              fontWeight: 800,
              fontSize: 20,
              color: !row.aBetter ? G.accent : G.ink,
              textAlign: 'left',
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
          padding: '4px 0',
          borderTop: `1px solid ${G.ink}`,
        }}
      >
        <Dots last3={a.last3} align="right" />
        <div
          style={{
            fontFamily: gMono,
            fontSize: 9,
            color: G.inkSoft,
            letterSpacing: '0.18em',
            fontWeight: 700,
            textAlign: 'center',
          }}
        >
          LAST 3
        </div>
        <Dots last3={b.last3} align="left" />
      </div>
    </GazetteFrame>
  );
}
