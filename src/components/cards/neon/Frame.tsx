// src/components/cards/neon/Frame.tsx
'use client';
import React from 'react';
import { N, nSans, nMono } from './tokens';

export function NeonFrame({
  children,
  title,
  badge,
  glowColor = N.pink,
}: {
  children: React.ReactNode;
  title: string;
  badge: string;
  glowColor?: string;
}) {
  return (
    <div
      className="tbl-card-neon"
      style={{
        width: 400,
        height: 400,
        boxSizing: 'border-box',
        background: N.bg,
        color: N.text,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${N.line}`,
        borderRadius: 16,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -80,
          right: -60,
          width: 220,
          height: 220,
          background: `radial-gradient(circle, ${glowColor}28, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'relative',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              fontFamily: nSans,
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: '-0.02em',
            }}
          >
            TBL{' '}
            <span
              style={{
                background: `linear-gradient(135deg, ${N.pink}, ${N.cyan})`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              STATS
            </span>
          </div>
        </div>
        <div
          style={{
            fontFamily: nMono,
            fontSize: 9.5,
            fontWeight: 600,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: glowColor,
            padding: '3px 8px',
            borderRadius: 999,
            border: `1px solid ${glowColor}40`,
            background: `${glowColor}14`,
          }}
        >
          {badge}
        </div>
      </div>
      <div style={{ position: 'relative', marginTop: 12, marginBottom: 10 }}>
        <div
          style={{
            fontFamily: nSans,
            fontWeight: 800,
            fontSize: 22,
            lineHeight: 1,
            letterSpacing: '-0.025em',
            color: N.text,
          }}
        >
          {title}
        </div>
      </div>
      <div
        style={{
          position: 'relative',
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
          position: 'relative',
          borderTop: `1px solid ${N.line}`,
          paddingTop: 8,
          marginTop: 8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            fontFamily: nMono,
            fontSize: 9,
            letterSpacing: '0.16em',
            color: N.textMute,
            fontWeight: 600,
          }}
        >
          @TEAMBOXINGLEAGUE
        </div>
        <div
          style={{
            fontFamily: nMono,
            fontSize: 9,
            letterSpacing: '0.16em',
            color: N.textMute,
            fontWeight: 600,
          }}
        >
          TBLSTATS.COM
        </div>
      </div>
    </div>
  );
}
