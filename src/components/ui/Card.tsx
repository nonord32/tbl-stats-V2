// src/components/ui/Card.tsx
// The bordered paper panel used by the rounds feed, the comeback cards, awards
// and the homepage advanced-stats grid. All four hand-rolled the same
// `background: var(--tbl-paper); border: 1.5px solid var(--tbl-ink)`.
export function Card({
  children,
  padding = '12px 14px',
  style,
  className,
}: {
  children: React.ReactNode;
  padding?: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--tbl-paper)',
        border: '1.5px solid var(--tbl-ink)',
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
