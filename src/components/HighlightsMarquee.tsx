'use client';
// src/components/HighlightsMarquee.tsx
// Auto-scrolling ticker of highlight thumbnails. Pauses on hover. Clicks open inline.

import React, { useState } from 'react';
import type { HighlightEntry } from '@/types';

function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) {
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const shorts = u.pathname.match(/\/shorts\/([^/?]+)/);
      if (shorts) return shorts[1];
      const embed = u.pathname.match(/\/embed\/([^/?]+)/);
      if (embed) return embed[1];
    }
    if (u.hostname === 'youtu.be') return u.pathname.replace('/', '');
  } catch {}
  return null;
}

function getInstagramPostId(url: string): string | null {
  try {
    const match = new URL(url).pathname.match(/\/(p|reel|tv)\/([^/]+)/);
    return match ? match[2] : null;
  } catch {}
  return null;
}

function InstagramModal({ postId, label, onClose }: { postId: string; label: string; onClose: () => void }) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(480px, 95vw)', maxHeight: '90vh', overflow: 'auto', borderRadius: 'var(--radius-lg)', background: '#fff', boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #eee' }}>
          <span style={{ fontWeight: 700, fontSize: 14, fontFamily: 'IBM Plex Mono, monospace' }}>{label || 'Instagram'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#666', lineHeight: 1, padding: 4 }}>×</button>
        </div>
        <iframe src={`https://www.instagram.com/p/${postId}/embed/`} title={label} scrolling="no" allowTransparency style={{ width: '100%', minHeight: 560, border: 'none', display: 'block' }} />
      </div>
    </div>
  );
}

function MarqueeCard({ entry, forcePlay = false }: { entry: HighlightEntry; forcePlay?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true); // auto-play starts muted
  const [igOpen, setIgOpen] = useState(false);
  const [thumbUrl, setThumbUrl] = useState('');

  const ytId = getYouTubeId(entry.url);
  const igId = getInstagramPostId(entry.url);

  React.useEffect(() => {
    if (ytId) setThumbUrl(`https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`);
  }, [ytId]);

  // Trigger auto-play when parent says so
  React.useEffect(() => {
    if (forcePlay && ytId) setPlaying(true);
  }, [forcePlay, ytId]);

  if (ytId) {
    const embedSrc = playing
      ? `https://www.youtube.com/embed/${ytId}?autoplay=1${muted ? '&mute=1' : ''}&rel=0`
      : '';
    return (
      <div className="mq-card" onClick={(e) => e.stopPropagation()}>
        {playing ? (
          <div className="mq-thumb" style={{ background: '#000' }}>
            <iframe
              src={embedSrc}
              title={entry.label}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
            />
            {/* Unmute button shown during auto-play */}
            {muted && (
              <button
                onClick={() => setMuted(false)}
                style={{
                  position: 'absolute', bottom: 10, right: 10, zIndex: 10,
                  background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 6, color: '#fff', cursor: 'pointer',
                  fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, fontWeight: 700,
                  padding: '4px 10px', letterSpacing: '0.04em',
                }}
              >
                🔇 Tap to unmute
              </button>
            )}
          </div>
        ) : (
          <button className="mq-thumb-btn" onClick={() => { setMuted(false); setPlaying(true); }} aria-label={`Play ${entry.label}`}>
            <div className="mq-thumb" style={{ background: '#111' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbUrl}
                alt={entry.label}
                onError={() => setThumbUrl(`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`)}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div className="mq-play-overlay">
                <svg width="44" height="30" viewBox="0 0 68 48" fill="none">
                  <rect width="68" height="48" rx="10" fill="#FF0000" fillOpacity="0.92"/>
                  <path d="M27 15l22 9-22 9V15z" fill="white"/>
                </svg>
              </div>
              <span className="mq-badge mq-badge-yt">YouTube</span>
            </div>
          </button>
        )}
        {entry.label && <div className="mq-label">{entry.label}</div>}
      </div>
    );
  }

  if (igId) {
    return (
      <>
        <div className="mq-card" onClick={(e) => e.stopPropagation()}>
          <button className="mq-thumb-btn" onClick={() => setIgOpen(true)} aria-label={`View ${entry.label}`}>
            <div className="mq-thumb mq-thumb-ig">
              <div className="mq-play-overlay">
                <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                  <circle cx="12" cy="12" r="4"/>
                  <circle cx="17.5" cy="6.5" r="1.5" fill="white" stroke="none"/>
                </svg>
              </div>
              <span className="mq-badge mq-badge-ig">Instagram</span>
            </div>
          </button>
          {entry.label && <div className="mq-label">{entry.label}</div>}
        </div>
        {igOpen && <InstagramModal postId={igId} label={entry.label} onClose={() => setIgOpen(false)} />}
      </>
    );
  }

  return (
    <a className="mq-card" href={entry.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
      <div className="mq-thumb" style={{ background: 'var(--bg-table-alt)' }}>
        <div className="mq-play-overlay">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
      </div>
      {entry.label && <div className="mq-label">{entry.label}</div>}
    </a>
  );
}

export function HighlightsMarquee({ highlights }: { highlights: HighlightEntry[] }) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [autoPlayIndex, setAutoPlayIndex] = React.useState<number | null>(null);

  // Find first YouTube clip index for auto-play
  const firstYtIndex = highlights.findIndex((h) => getYouTubeId(h.url) !== null);

  React.useEffect(() => {
    if (firstYtIndex === -1) return;
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAutoPlayIndex(firstYtIndex);
          observer.disconnect(); // only trigger once
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [firstYtIndex]);

  if (highlights.length === 0) return null;

  return (
    <div className="mq-root" ref={rootRef}>
      <div className="mq-header">
        <span className="mq-title">
          <span className="mq-dot" />
          Highlights
        </span>
      </div>
      <div className="mq-static-row">
        {highlights.map((h, i) => (
          <MarqueeCard key={i} entry={h} forcePlay={i === autoPlayIndex} />
        ))}
      </div>
    </div>
  );
}
