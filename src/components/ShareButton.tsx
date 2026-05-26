'use client';

// Small share pill for the match hero. Pre-fetches the dynamic OG PNG
// on mount so the share click happens inside iOS Safari's user-gesture
// window — fetching inside the click breaks the gesture and iOS blocks
// the share sheet with files.
import { useEffect, useRef, useState } from 'react';

type Props = {
  url: string;
  imageUrl: string;
  title: string;
  text?: string;
  fileName?: string;
};

export function ShareButton({ url, imageUrl, title, text, fileName }: Props) {
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<File | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const origin = window.location.origin;
        const absoluteImg = imageUrl.startsWith('/')
          ? `${origin}${imageUrl}`
          : imageUrl;
        const res = await fetch(absoluteImg, { cache: 'force-cache' });
        if (!res.ok) return;
        const blob = await res.blob();
        if (cancelled) return;
        fileRef.current = new File([blob], fileName || 'tbl-match.png', {
          type: blob.type || 'image/png',
        });
      } catch {
        // ignore — share will fall back to URL-only
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [imageUrl, fileName]);

  async function handleClick() {
    const origin = window.location.origin;
    const absoluteUrl = url.startsWith('/') ? `${origin}${url}` : url;
    const file = fileRef.current;

    // File share — must be called synchronously in the click handler
    // (no awaits before) so iOS keeps the user-gesture token alive.
    if (
      file &&
      typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({ files: [file], title, text, url: absoluteUrl });
        return;
      } catch {
        return; // user dismissed
      }
    }

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url: absoluteUrl });
        return;
      } catch {
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
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
