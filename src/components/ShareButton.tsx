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
      style={{
        position: 'absolute',
        top: 12,
        right: 14,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 999,
        border: '1px solid rgba(244,237,224,0.3)',
        background: 'rgba(244,237,224,0.08)',
        color: 'var(--tbl-bg)',
        fontFamily: 'var(--tbl-font-mono)',
        fontSize: 10,
        letterSpacing: '0.22em',
        fontWeight: 700,
        textTransform: 'uppercase',
        cursor: 'pointer',
        lineHeight: 1,
      }}
    >
      <svg
        width="12"
        height="12"
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
      {copied ? 'Copied' : 'Share'}
    </button>
  );
}
