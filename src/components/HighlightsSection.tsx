'use client';
// src/components/HighlightsSection.tsx

import React from 'react';
import type { HighlightEntry } from '@/types';

function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
    if (u.hostname === 'youtu.be') return u.pathname.replace('/', '');
    if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2];
  } catch {}
  return null;
}

function isInstagram(url: string) {
  try { return new URL(url).hostname.includes('instagram.com'); } catch { return false; }
}

function YouTubeCard({ videoId, label, url }: { videoId: string; label: string; url: string }) {
  const thumb = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="highlight-card" style={{ textDecoration: 'none', display: 'block' }}>
      <div className="highlight-thumb" style={{ backgroundImage: `url(${thumb})` }}>
        <div className="highlight-play">
          {/* YouTube play icon */}
          <svg width="48" height="48" viewBox="0 0 68 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="68" height="48" rx="10" fill="#FF0000" fillOpacity="0.85"/>
            <path d="M27 15l22 9-22 9V15z" fill="white"/>
          </svg>
        </div>
        <div className="highlight-source-badge highlight-source-yt">YouTube</div>
      </div>
      {label && <div className="highlight-label">{label}</div>}
    </a>
  );
}

function InstagramCard({ url, label }: { url: string; label: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="highlight-card" style={{ textDecoration: 'none', display: 'block' }}>
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
      {label && <div className="highlight-label">{label}</div>}
    </a>
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
          if (ytId) return <YouTubeCard key={i} videoId={ytId} label={h.label} url={h.url} />;
          if (isInstagram(h.url)) return <InstagramCard key={i} url={h.url} label={h.label} />;
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
