'use client';

// Small share pill for the match hero. Uses the Web Share API on mobile
// (gives the native iOS / Android share sheet) and falls back to copying
// the URL to the clipboard on desktop.
import { useState } from 'react';

type Props = {
  url: string;
  title: string;
  text?: string;
};

export function ShareButton({ url, title, text }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    const absoluteUrl =
      typeof window !== 'undefined' && url.startsWith('/')
        ? `${window.location.origin}${url}`
        : url;

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url: absoluteUrl });
        return;
      } catch {
        // User dismissed or share failed — fall through to copy.
      }
    }
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Last-resort: open a prompt so the user can copy manually.
      window.prompt('Copy this link:', absoluteUrl);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Share match"
      title={copied ? 'Copied' : 'Share'}
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        borderRadius: 999,
        border: '1px solid rgba(244,237,224,0.3)',
        background: copied
          ? 'var(--tbl-accent-bright)'
          : 'rgba(244,237,224,0.08)',
        color: copied ? 'var(--tbl-ink)' : 'var(--tbl-bg)',
        cursor: 'pointer',
        padding: 0,
        transition: 'background 120ms ease',
      }}
    >
      {copied ? (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      )}
    </button>
  );
}
