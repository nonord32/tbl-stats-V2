// src/components/cards/gazette/Frame.tsx
'use client';
import React from 'react';
import { G, gSerif, gMono } from './tokens';

export function GazetteFrame({
  children,
  title,
  badge,
}: {
  children: React.ReactNode;
  title: string;
  badge: string;
}) {
  return (
    <div
      className="tbl-card-gazette"
      style={{
        width: 400,
        height: 400,
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
        background: G.bg,
        color: G.ink,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        backgroundImage:
          'radial-gradient(circle at 20% 30%, rgba(139,108,66,0.05) 0 1px, transparent 1px),' +
          'radial-gradient(circle at 70% 80%, rgba(139,108,66,0.04) 0 1px, transparent 1px)',
        backgroundSize: '3px 3px, 5px 5px',
      }}
    >
      <div
        style={{
          borderTop: `3px double ${G.ink}`,
          borderBottom: `1px solid ${G.ink}`,
          padding: '6px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            fontFamily: gMono,
            fontSize: 9,
            letterSpacing: '0.22em',
            color: G.accent,
            fontWeight: 700,
            textTransform: 'uppercase',
          }}
        >
          TBLStats
        </div>
        <div
          style={{
            fontFamily: gMono,
            fontSize: 9,
            letterSpacing: '0.2em',
            color: G.inkSoft,
            fontWeight: 600,
          }}
        >
          {badge}
        </div>
      </div>
      <div style={{ marginTop: 10, marginBottom: 10 }}>
        <div
          style={{
            fontFamily: gSerif,
            fontWeight: 900,
            fontSize: 24,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {children}
      </div>
      <div
        style={{
          borderTop: `1px solid ${G.ink}`,
          paddingTop: 6,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            fontFamily: gMono,
            fontSize: 8.5,
            letterSpacing: '0.18em',
            color: G.inkSoft,
            fontWeight: 600,
          }}
        >
          @TEAMBOXINGLEAGUE
        </div>
        <div
          style={{
            fontFamily: gMono,
            fontSize: 8.5,
            letterSpacing: '0.18em',
            color: G.inkSoft,
            fontWeight: 600,
          }}
        >
          TBLSTATS.COM
        </div>
      </div>
    </div>
  );
}
