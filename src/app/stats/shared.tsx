// src/app/stats/shared.tsx
// The scaffolding every stat section shares. These were five byte-identical
// copies of `Section` and `prose`, plus two near-identical copies of the table
// styles that differed only in horizontal padding (10px vs 12px) — 10px wins.
import { SectionRule } from '@/components/chrome/SectionRule';

export const prose: React.CSSProperties = {
  fontFamily: 'var(--tbl-font-body)',
  fontSize: 15,
  lineHeight: 1.75,
  color: 'var(--tbl-ink)',
  margin: '0 0 14px',
};

export const proseSmall: React.CSSProperties = {
  ...prose,
  fontSize: 13,
  color: 'var(--tbl-ink-soft)',
};

export const monoTh: React.CSSProperties = {
  fontFamily: 'var(--tbl-font-mono)',
  fontSize: 10,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--tbl-ink-soft)',
  fontWeight: 700,
  padding: '6px 10px',
  borderBottom: '1.5px solid var(--tbl-ink)',
  textAlign: 'right',
};

export const monoTd: React.CSSProperties = {
  fontFamily: 'var(--tbl-font-mono)',
  fontSize: 12,
  padding: '7px 10px',
  borderBottom: '1px dotted rgba(20,17,11,0.3)',
  textAlign: 'right',
};

/** A titled block inside one stat's section. */
export function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 30 }}>
      <SectionRule left={title} />
      {children}
    </section>
  );
}

/**
 * One stat's whole section, anchored so /stats#wpa and friends land on it.
 * The old per-stat pages each had their own 54px masthead; here the page has
 * one masthead and each stat gets a heading beneath it.
 */
export function StatSection({
  id,
  title,
  standfirst,
  children,
}: {
  id: string;
  title: string;
  standfirst?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} style={{ scrollMarginTop: 24, marginTop: 54 }}>
      <div
        style={{
          borderTop: '3px double var(--tbl-ink)',
          paddingTop: 18,
        }}
      >
        <h2 className="tbl-display" style={{ fontSize: 36, lineHeight: 1, margin: 0 }}>
          {title}
        </h2>
        {standfirst && (
          <p style={{ ...prose, fontSize: 16, margin: '10px 0 0', maxWidth: '68ch' }}>{standfirst}</p>
        )}
      </div>
      {children}
    </section>
  );
}

/** The collapsible formal spec that sits at the end of a stat's section. */
export function TechDetails({ children }: { children: React.ReactNode }) {
  return (
    <details style={{ marginTop: 28, maxWidth: 860 }}>
      <summary
        style={{
          cursor: 'pointer',
          fontFamily: 'var(--tbl-font-mono)',
          fontSize: 11,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          fontWeight: 700,
          color: 'var(--tbl-accent)',
          padding: '10px 0',
          borderTop: '1.5px solid var(--tbl-ink)',
          borderBottom: '1.5px solid var(--tbl-ink)',
        }}
      >
        Technical Details — the formal spec
      </summary>
      <div style={{ paddingTop: 16 }}>{children}</div>
    </details>
  );
}
