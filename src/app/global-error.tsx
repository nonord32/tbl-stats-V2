'use client';
// src/app/global-error.tsx
// Catches errors in the root layout itself, where error.tsx can't render.
// Must include <html> and <body> because it replaces the root layout.
// Uses inline styles because globals.css may not be available here.

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global error boundary]', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          fontFamily:
            "'IBM Plex Mono', 'Courier New', monospace",
          background: '#f5f3f0',
          color: '#1a1720',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: '100%',
            background: '#ffffff',
            border: '1px solid #d8d4cd',
            borderRadius: 10,
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            padding: 32,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 40,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: '#1a1720',
              marginBottom: 24,
            }}
          >
            TBL<span style={{ color: '#e63500' }}>Stats</span>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 13, color: '#6b6578', margin: '0 0 20px' }}>
            The site hit an unexpected error. Please try again.
          </p>
          {error.digest && (
            <p style={{ fontSize: 11, color: '#6b6578', opacity: 0.7, margin: '0 0 20px' }}>
              Ref: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '10px 20px',
              borderRadius: 6,
              cursor: 'pointer',
              border: 'none',
              background: '#e63500',
              color: '#fff',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
