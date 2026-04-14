// src/app/not-found.tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="page" style={{ textAlign: 'center', paddingTop: 80 }}>
      <div className="container">
        <div
          style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 72,
            fontWeight: 700,
            color: 'var(--accent)',
            lineHeight: 1,
          }}
        >
          404
        </div>
        <h1
          style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 20,
            fontWeight: 600,
            marginTop: 12,
            marginBottom: 8,
            color: 'var(--text-heading)',
          }}
        >
          Page Not Found
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
          This fighter or team doesn&apos;t exist yet — or the slug may have changed.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/fighters" className="btn btn-primary">Fighter Stats</Link>
          <Link href="/teams" className="btn btn-outline" style={{ color: 'var(--text)', borderColor: 'var(--border)' }}>Team Standings</Link>
          <Link href="/" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, alignSelf: 'center', color: 'var(--text-muted)' }}>← Home</Link>
        </div>
      </div>
    </div>
  );
}
