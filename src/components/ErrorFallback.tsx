'use client';
// src/components/ErrorFallback.tsx
// Shared branded error UI used by route-level error.tsx boundaries.

import Link from 'next/link';
import { useEffect } from 'react';

export interface ErrorFallbackProps {
  title: string;
  description: string;
  error: Error & { digest?: string };
  reset: () => void;
  /** Optional extra link shown next to "Home" */
  secondaryHref?: string;
  secondaryLabel?: string;
}

const linkStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--accent)',
};

export function ErrorFallback({
  title,
  description,
  error,
  reset,
  secondaryHref,
  secondaryLabel,
}: ErrorFallbackProps) {
  useEffect(() => {
    console.error('[error boundary]', error);
  }, [error]);

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 560 }}>
        <div
          className="card"
          style={{ padding: 32, textAlign: 'center', marginTop: 40 }}
        >
          <h1
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--text-heading)',
              marginBottom: 8,
            }}
          >
            {title}
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: 'var(--text-muted)',
              marginBottom: 24,
            }}
          >
            {description}
          </p>
          {error.digest && (
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--text-muted)',
                opacity: 0.7,
                marginBottom: 20,
              }}
            >
              Ref: {error.digest}
            </p>
          )}
          <div
            style={{
              display: 'flex',
              gap: 18,
              justifyContent: 'center',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button onClick={reset} className="btn btn-primary">
              Try again
            </button>
            <Link href="/" style={linkStyle}>
              Home
            </Link>
            {secondaryHref && secondaryLabel && (
              <Link href={secondaryHref} style={linkStyle}>
                {secondaryLabel}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
