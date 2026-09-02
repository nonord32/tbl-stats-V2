// src/components/ui/StatTile.tsx
//
// The label/value pair, which had eight independent implementations across the
// site. They varied on three cosmetic axes — label size (8/9/10), tracking
// (0.14em–0.24em) and colour — and on two structural ones that a single fixed
// look could not have absorbed:
//
//   orientation  'inline' puts label and value on one baseline, left and right
//                (the fighter profile's stat sheet). 'stacked' puts the label
//                above the value (team hero, WAR constants, comeback cards).
//   order        'value-first' inverts a stacked tile so the number leads and
//                the label sits under it (the rounds feed).
//
// The value is always `.tbl-display`; only its size varies, so that is a scale
// rather than a free number.

export type TileSize = 'sm' | 'md' | 'lg' | 'xl';
export type TileTone = 'soft' | 'mute' | 'inverse';

const VALUE_SIZE: Record<TileSize, number> = { sm: 21, md: 26, lg: 30, xl: 38 };
const LABEL_SIZE: Record<TileSize, number> = { sm: 10, md: 9, lg: 9, xl: 9 };
const LABEL_TRACK: Record<TileSize, string> = {
  sm: '0.14em',
  md: '0.18em',
  lg: '0.22em',
  xl: '0.2em',
};
const LABEL_COLOR: Record<TileTone, string> = {
  soft: 'var(--tbl-ink-soft)',
  mute: 'var(--tbl-ink-mute)',
  inverse: 'rgba(244,237,224,0.55)',
};

export interface StatTileProps {
  label: string;
  value: React.ReactNode;
  /** small muted note shown just before the value (a per-round rate, a ± range) */
  pre?: string;
  /** parenthetical clarifier after the label */
  hint?: string;
  size?: TileSize;
  tone?: TileTone;
  /** colour of the value itself */
  color?: string;
  orientation?: 'inline' | 'stacked';
  /** stacked only: put the value above the label */
  valueFirst?: boolean;
  align?: 'left' | 'center' | 'right';
}

export function StatTile({
  label,
  value,
  pre,
  hint,
  size = 'sm',
  tone = 'soft',
  color,
  orientation = 'inline',
  valueFirst = false,
  align,
}: StatTileProps) {
  const labelEl = (
    <span
      style={{
        fontFamily: 'var(--tbl-font-mono)',
        fontSize: LABEL_SIZE[size],
        letterSpacing: LABEL_TRACK[size],
        color: LABEL_COLOR[tone],
        textTransform: 'uppercase',
        fontWeight: orientation === 'stacked' ? 700 : undefined,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      {hint && (
        <span style={{ color: 'var(--tbl-ink-mute)', letterSpacing: '0.08em' }}> {hint}</span>
      )}
    </span>
  );

  const valueEl = (
    <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
      {pre && (
        <span
          style={{
            fontFamily: 'var(--tbl-font-mono)',
            fontSize: 10,
            color: 'var(--tbl-ink-soft)',
          }}
        >
          {pre}
        </span>
      )}
      <span
        className="tbl-display"
        style={{ fontSize: VALUE_SIZE[size], lineHeight: 1, color: color ?? 'inherit' }}
      >
        {value}
      </span>
    </span>
  );

  if (orientation === 'inline') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 10,
          minWidth: 0,
        }}
      >
        {labelEl}
        {valueEl}
      </div>
    );
  }

  return (
    <div style={{ textAlign: align ?? 'center' }}>
      {valueFirst ? (
        <>
          {valueEl}
          <div style={{ marginTop: 2 }}>{labelEl}</div>
        </>
      ) : (
        <>
          {labelEl}
          <div style={{ marginTop: 3 }}>{valueEl}</div>
        </>
      )}
    </div>
  );
}
