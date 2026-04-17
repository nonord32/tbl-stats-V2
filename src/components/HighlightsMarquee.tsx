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

function MarqueeCard({ entry }: { entry: HighlightEntry }) {
  const [playing, setPlaying] = useState(false);
  const [igOpen, setIgOpen] = useState(false);
  const [thumbUrl, setThumbUrl] = useState('');

  const ytId = getYouTubeId(entry.url);
  const igId = getInstagramPostId(entry.url);

  React.useEffect(() => {
    if (ytId) setThumbUrl(`https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`);
  }, [ytId]);

  if (ytId) {
    return (
      <div className="mq-card" onClick={(e) => e.stopPropagation()}>
        {playing ? (
          <div className="mq-thumb" style={{ background: '#000' }}>
            <iframe
              src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
              title={entry.label}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
            />
          </div>
        ) : (
          <button className="mq-thumb-btn" onClick={() => setPlaying(true)} aria-label={`Play ${entry.label}`}>
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
  if (highlights.length === 0) return null;
  // Duplicate items so the loop is seamless
  const items = highlights.length < 4 ? [...highlights, ...highlights, ...highlights] : [...highlights, ...highlights];

  return (
    <div className="mq-root">
      <div className="mq-header">
        <span className="mq-title">
          <span className="mq-dot" />
          Highlights
        </span>
      </div>
      <div className="mq-track-wrap">
        <div className="mq-track" style={{ '--item-count': items.length } as React.CSSProperties}>
          {items.map((h, i) => (
            <MarqueeCard key={i} entry={h} />
          ))}
        </div>
      </div>
    </div>
  );
}
