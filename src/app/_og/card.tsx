// src/app/_og/card.tsx
// Shared building blocks for the dynamic Open Graph cards (fighter, team,
// match). Everything here is rendered by Satori inside `next/og`'s
// ImageResponse — it is NOT hydrated React, so keep it to plain elements with
// inline styles and remember Satori's rule: any element with more than one
// child needs an explicit `display: 'flex'`.
//
// `_og` is a private folder (underscore prefix), so it never becomes a route.
import { readFileSync } from 'node:fs';
import type { ReactNode } from 'react';

// ── Canvas ─────────────────────────────────────────────────────────────────
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

// ── Palette — copied verbatim from src/app/globals.css, nothing invented ────
export const INK = '#14110b'; //            --tbl-ink        (dark card background)
export const CREAM = '#f4ede0'; //          --tbl-bg         (on-dark text, per --nav-text)
export const ACCENT = '#ff3c00'; //         --tbl-accent-bright
export const MUTED = 'rgba(244,237,224,0.55)';
export const FAINT = 'rgba(244,237,224,0.85)';
const HAIR = 'rgba(244,237,224,0.20)';

// ── Fonts — the site's own Playfair Display + IBM Plex Mono, bundled in-repo.
// These routes run on the Node runtime (Node's fetch() can't read file: URLs),
// so we read the .ttf synchronously. `new URL('./fonts/…', import.meta.url)`
// is statically analyzable, so Next traces the font files into the output.
function readFont(file: string): Buffer {
  return readFileSync(new URL(`./fonts/${file}`, import.meta.url));
}

export function loadOgFonts() {
  return [
    { name: 'Playfair', data: readFont('PlayfairDisplay-Black.ttf'), weight: 900 as const, style: 'normal' as const },
    { name: 'Playfair', data: readFont('PlayfairDisplay-Bold.ttf'), weight: 700 as const, style: 'normal' as const },
    { name: 'PlexMono', data: readFont('IBMPlexMono-Bold.ttf'), weight: 700 as const, style: 'normal' as const },
    { name: 'PlexMono', data: readFont('IBMPlexMono-Regular.ttf'), weight: 400 as const, style: 'normal' as const },
  ];
}

// ── Helpers ────────────────────────────────────────────────────────────────
// Fit the display name to one line at 1200px wide.
function nameSize(text: string): number {
  const n = text.length;
  if (n <= 10) return 132;
  if (n <= 15) return 112;
  if (n <= 20) return 92;
  if (n <= 26) return 76;
  if (n <= 32) return 64;
  return 54;
}

// "Las Vegas Hustle" → ["Las Vegas", "Hustle"] for the two-tone hero name.
export function splitName(full: string): [string, string] {
  const parts = full.split(' ');
  if (parts.length < 2) return [full, ''];
  return [parts.slice(0, -1).join(' '), parts[parts.length - 1]];
}

// 1 → "1st", 2 → "2nd", 11 → "11th".
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

export interface Stat {
  label: string;
  value: string;
  accent?: boolean;
}

function StatBlock({ label, value, accent }: Stat) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          fontFamily: 'PlexMono',
          fontWeight: 700,
          fontSize: 20,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: MUTED,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'Playfair',
          fontWeight: 900,
          fontSize: 72,
          lineHeight: 1,
          color: accent ? ACCENT : CREAM,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Branding() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <div style={{ fontFamily: 'Playfair', fontWeight: 900, fontSize: 34, color: CREAM }}>
        tblstats.com
      </div>
      <div
        style={{
          fontFamily: 'PlexMono',
          fontWeight: 700,
          fontSize: 15,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: MUTED,
        }}
      >
        The Official Record · 2026
      </div>
    </div>
  );
}

// Shell used by every card: dark gazette band, padding, space-between column.
export function CardShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: INK,
        color: CREAM,
        padding: '68px 72px',
        justifyContent: 'space-between',
        fontFamily: 'Playfair',
      }}
    >
      {children}
    </div>
  );
}

// ── Entity card: eyebrow · big name · sub-line · 3 stats + corner branding ──
// Used by the fighter and team OG routes.
export function EntityCard({
  eyebrow,
  name,
  nameTwoTone,
  sub,
  stats,
}: {
  eyebrow: string;
  name: string;
  nameTwoTone?: string;
  sub?: ReactNode;
  stats: Stat[];
}) {
  const full = nameTwoTone ? `${name} ${nameTwoTone}` : name;
  return (
    <CardShell>
      <div
        style={{
          display: 'flex',
          fontFamily: 'PlexMono',
          fontWeight: 700,
          fontSize: 24,
          letterSpacing: '0.26em',
          textTransform: 'uppercase',
          color: ACCENT,
        }}
      >
        {eyebrow}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            fontFamily: 'Playfair',
            fontWeight: 900,
            fontSize: nameSize(full),
            lineHeight: 0.94,
            letterSpacing: '-0.02em',
            color: CREAM,
          }}
        >
          {name}
          {nameTwoTone ? <span style={{ color: CREAM, opacity: 0.65 }}>&nbsp;{nameTwoTone}</span> : null}
        </div>
        {sub ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 22 }}>{sub}</div>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          paddingTop: 30,
          borderTop: `2px solid ${HAIR}`,
          alignItems: 'flex-end',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 90 }}>
          {stats.map((s) => (
            <StatBlock key={s.label} {...s} />
          ))}
        </div>
        <Branding />
      </div>
    </CardShell>
  );
}

// Minimal branded fallback so a bad slug never yields a broken preview image.
export function FallbackCard() {
  return (
    <CardShell>
      <div style={{ display: 'flex' }} />
      <div
        style={{
          display: 'flex',
          fontFamily: 'Playfair',
          fontWeight: 900,
          fontSize: 120,
          letterSpacing: '-0.02em',
        }}
      >
        TBL Stats
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Branding />
      </div>
    </CardShell>
  );
}
