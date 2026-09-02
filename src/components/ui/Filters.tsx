'use client';
// src/components/ui/Filters.tsx
//
// The filter controls, in one place. These replace 21 hand-rolled controls
// across four idioms: `gz-filter` label+select (9), `gz-filter` label+checkbox
// (2, with the label AFTER the control instead of before), `gz-seg__btn`
// segmented buttons (1), and the legacy `.filter-select` / `.fighters-mobile-select`
// bare selects (9, with no label at all).
//
// Two inconsistencies get settled here rather than reproduced: seven of the nine
// selects redundantly re-declared `gap: 6` over the stylesheet's 8px, and the
// only segmented control on the site was missing its `.gz-seg` wrapper class —
// which is why that class showed up as dead CSS.

export function FilterBar({
  children,
  hint,
}: {
  children: React.ReactNode;
  /** right-aligned note, e.g. "Click any column to sort" */
  hint?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        margin: '0 0 12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        {children}
      </div>
      {hint && (
        <span
          style={{
            fontFamily: 'var(--tbl-font-mono)',
            fontSize: 10,
            letterSpacing: '0.1em',
            color: 'var(--tbl-ink-soft)',
          }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}

export interface Option {
  value: string;
  label: string;
}

export function Select({
  label,
  value,
  options,
  onChange,
  ariaLabel,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  return (
    <label className="gz-filter">
      <span className="gz-filter__label">{label}</span>
      <select
        className="gz-filter__select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel ?? label}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** A checkbox. Label sits after the control, as it did in both originals. */
export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="gz-filter gz-filter--toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="gz-filter__label">{label}</span>
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="gz-seg" role="tablist" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={`gz-seg__btn${value === o.value ? ' is-active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
