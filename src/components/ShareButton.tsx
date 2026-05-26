'use client';

// Small share pill for the match hero. Tries to share the dynamic OG
// card as an actual PNG file via the Web Share API (Level 2) so the
// recipient gets the image embedded, not just a link preview. Falls
// back to URL-only share, then clipboard copy.
import { useState } from 'react';

type Props = {
  url: string;
  imageUrl: string;
  title: string;
  text?: string;
  fileName?: string;
};

export function ShareButton({ url, imageUrl, title, text, fileName }: Props) {
  const [state, setState] = useState<'idle' | 'busy' | 'copied'>('idle');

  async function handleClick() {
    if (state === 'busy') return;
    setState('busy');

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const absoluteUrl = url.startsWith('/') ? `${origin}${url}` : url;
    const absoluteImg = imageUrl.startsWith('/') ? `${origin}${imageUrl}` : imageUrl;
    const name = fileName || 'tbl-match.png';

    // Best path: share the PNG itself. Works on iOS Safari 15+, recent
    // Chrome on Android, and most desktop browsers that support Web
    // Share API Level 2.
    try {
      const res = await fetch(absoluteImg, { cache: 'force-cache' });
      if (res.ok) {
        const blob = await res.blob();
        const file = new File([blob], name, { type: blob.type || 'image/png' });
        if (
          typeof navigator !== 'undefined' &&
          typeof navigator.canShare === 'function' &&
          navigator.canShare({ files: [file] })
        ) {
          await navigator.share({ files: [file], title, text, url: absoluteUrl });
          setState('idle');
          return;
        }
      }
    } catch {
      // fall through to URL-only share
    }

    // URL-only share — still pops the native sheet, recipient gets the
    // OG card via link-preview.
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url: absoluteUrl });
        setState('idle');
        return;
      } catch {
        // user dismissed — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setState('copied');
      setTimeout(() => setState('idle'), 1600);
      return;
    } catch {
      window.prompt('Copy this link:', absoluteUrl);
      setState('idle');
    }
  }

  const copied = state === 'copied';
  const busy = state === 'busy';

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Share match"
      title={copied ? 'Copied' : 'Share'}
      disabled={busy}
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
        cursor: busy ? 'wait' : 'pointer',
        padding: 0,
        transition: 'background 120ms ease',
        opacity: busy ? 0.7 : 1,
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
      ) : busy ? (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          aria-hidden="true"
          style={{ animation: 'tbl-share-spin 0.8s linear infinite' }}
        >
          <path d="M21 12a9 9 0 1 1-6.2-8.55" />
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
      <style>{`@keyframes tbl-share-spin { to { transform: rotate(360deg); } }`}</style>
    </button>
  );
}
