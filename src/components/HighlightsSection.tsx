'use client';
// src/components/HighlightsSection.tsx

import React, { useState, useEffect } from 'react';
import type { HighlightEntry } from '@/types';

function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) {
      // Regular: youtube.com/watch?v=ID
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      // Shorts: youtube.com/shorts/ID
      const shortsMatch = u.pathname.match(/\/shorts\/([^/?]+)/);
      if (shortsMatch) return shortsMatch[1];
      // Embed: youtube.com/embed/ID
      const embedMatch = u.pathname.match(/\/embed\/([^/?]+)/);
      if (embedMatch) return embedMatch[1];
    }
    // youtu.be/ID
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

function YouTubeCard({ videoId, label }: { videoId: string; label: string }) {
  const [playing, setPlaying] = useState(false);
  // Try maxresdefault (creator-set thumbnail, clean), fall back to hqdefault
  const [thumbUrl, setThumbUrl] = useState(`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`);

  return (
    <div className="highlight-card">
      {playing ? (
        <div className="highlight-thumb" style={{ background: '#000' }}>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            title={label}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
          />
        </div>
      ) : (
        <button
          onClick={() => setPlaying(true)}
          className="highlight-thumb-btn"
          aria-label={`Play ${label}`}
        >
          <div className="highlight-thumb">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbUrl}
              alt={label}
              onError={() => setThumbUrl(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`)}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div className="highlight-play">
              <svg width="52" height="36" viewBox="0 0 68 48" fill="none">
                <rect width="68" height="48" rx="10" fill="#FF0000" fillOpacity="0.9"/>
                <path d="M27 15l22 9-22 9V15z" fill="white"/>
              </svg>
            </div>
            <div className="highlight-source-badge highlight-source-yt">YouTube</div>
          </div>
        </button>
      )}
      {label && <div className="highlight-label">{label}</div>}
    </div>
  );
}

function InstagramModal({ postId, label, onClose }: { postId: string; label: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(480px, 95vw)',
          maxHeight: '90vh',
          overflow: 'auto',
          borderRadius: 'var(--radius-lg)',
          background: '#fff',
          boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #eee' }}>
          <span style={{ fontWeight: 700, fontSize: 14, fontFamily: 'IBM Plex Mono, monospace' }}>{label || 'Instagram'}</span>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#666', lineHeight: 1, padding: 4 }}>×</button>
        </div>
        <iframe
          src={`https://www.instagram.com/p/${postId}/embed/`}
          title={label}
          scrolling="no"
          allowTransparency
          style={{ width: '100%', minHeight: 560, border: 'none', display: 'block' }}
        />
      </div>
    </div>
  );
}

function InstagramCard({ url, label, postId }: { url: string; label: string; postId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="highlight-card">
        <button
          onClick={() => setOpen(true)}
          className="highlight-thumb-btn"
          aria-label={`View ${label}`}
        >
          <div className="highlight-thumb highlight-thumb-ig">
            <div className="highlight-play">
              <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <circle cx="12" cy="12" r="4"/>
                <circle cx="17.5" cy="6.5" r="1.5" fill="white" stroke="none"/>
              </svg>
            </div>
            <div className="highlight-source-badge highlight-source-ig">Instagram</div>
          </div>
        </button>
        {label && <div className="highlight-label">{label}</div>}
      </div>
      {open && <InstagramModal postId={postId} label={label} onClose={() => setOpen(false)} />}
    </>
  );
}

export function HighlightsSection({ highlights, title = 'Highlights' }: { highlights: HighlightEntry[]; title?: string }) {
  if (highlights.length === 0) return null;
  return (
    <div style={{ marginBottom: 32 }}>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18 }}>{title}</h2>
        <div className="subtitle">{highlights.length} clip{highlights.length !== 1 ? 's' : ''}</div>
      </div>
      <div className="highlights-grid">
        {highlights.map((h, i) => {
          const ytId = getYouTubeId(h.url);
          if (ytId) return <YouTubeCard key={i} videoId={ytId} label={h.label} />;
          const igId = getInstagramPostId(h.url);
          if (igId) return <InstagramCard key={i} url={h.url} label={h.label} postId={igId} />;
          return (
            <a key={i} href={h.url} target="_blank" rel="noopener noreferrer" className="highlight-card" style={{ textDecoration: 'none', display: 'block' }}>
              <div className="highlight-thumb" style={{ background: 'var(--bg-table-alt)' }}>
                <div className="highlight-play">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" fill="white"/></svg>
                </div>
              </div>
              {h.label && <div className="highlight-label">{h.label}</div>}
            </a>
          );
        })}
      </div>
    </div>
  );
}
