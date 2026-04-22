// src/components/DataUnavailable.tsx
// Empty-state card used when the Google Sheets source returned nothing —
// lets users distinguish "no data yet this season" from "the upstream
// source is having problems".

interface Props {
  title?: string;
  description?: string;
}

export function DataUnavailable({
  title = 'Data temporarily unavailable',
  description = 'We couldn’t load this from the source. Try refreshing in a minute.',
}: Props) {
  return (
    <div
      className="card"
      style={{ padding: 32, textAlign: 'center', marginTop: 16 }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--accent)',
          marginBottom: 10,
        }}
      >
        No data
      </div>
      <h2
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--text-heading)',
          marginBottom: 6,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--text-muted)',
          maxWidth: 400,
          margin: '0 auto',
        }}
      >
        {description}
      </p>
    </div>
  );
}
