'use client';
// src/components/HighlightsSection.tsx
// Renders a grid of YouTube embeds and Instagram link cards.

import React, { useEffect, useRef } from 'react';
import type { HighlightEntry } from '@/types';

function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    // youtube.com/watch?v=ID
    if (u.hostname.includes('youtube.com')) {
      return u.searchParams.get('v');
    }
    // youtu.be/ID
    if (u.hostname === 'youtu.be') {
      return u.pathname.replace('/', '');
    }
    // youtube.com/embed/ID
    if (u.pathname.startsWith('/embed/')) {
      return u.pathname.split('/')[2];
    }
  } catch {}
  return null;
}

function getInstagramPostId(url: string): string | null {
  try {
    const u = new URL(url);
    // instagram.com/p/CODE/ or instagram.com/reel/CODE/
    const match = u.pathname.match(/\/(p|reel|tv)\/([^/]+)/);
    return match ? match[2] : null;
  } catch {}
  return null;
}

function YouTubeEmbed({ videoId, label }: { videoId: string; label: string }) {
  return (
    <div className="highlight-card">
      <div className="highlight-embed-wrap">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title={label}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none', borderRadius: 'var(--radius)' }}
        />
      </div>
      {label && (
        <div className="highlight-label">{label}</div>
      )}
    </div>
  );
}

function InstagramEmbed({ url, label }: { url: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Re-process any blockquotes after mount
    if (typeof window !== 'undefined' && (window as Window & { instgrm?: { Embeds?: { process?: () => void } } }).instgrm?.Embeds?.process) {
      (window as Window & { instgrm?: { Embeds?: { process?: () => void } } }).instgrm!.Embeds!.process!();
    }
  }, [url]);

  return (
    <div className="highlight-card" ref={ref}>
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={url}
        data-instgrm-version="14"
        style={{
          background: '#FFF',
          border: '0',
          borderRadius: '3px',
          boxShadow: '0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15)',
          margin: '0',
          minWidth: '326px',
          padding: '0',
          width: '100%',
        }}
      >
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: 16, color: 'var(--accent)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>
          {label || 'View on Instagram ↗'}
        </a>
      </blockquote>
      {/* Instagram embed script — loads once per page */}
      <script async src="//www.instagram.com/embed.js" />
    </div>
  );
}

function InstagramLinkCard({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="highlight-card highlight-link-card"
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <div className="highlight-ig-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#ig-hl-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <defs>
            <linearGradient id="ig-hl-grad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f09433"/>
              <stop offset="25%" stopColor="#e6683c"/>
              <stop offset="50%" stopColor="#dc2743"/>
              <stop offset="75%" stopColor="#cc2366"/>
              <stop offset="100%" stopColor="#bc1888"/>
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
          <circle cx="12" cy="12" r="4"/>
          <circle cx="17.5" cy="6.5" r="1" fill="url(#ig-hl-grad)" stroke="none"/>
        </svg>
      </div>
      <div className="highlight-label" style={{ marginTop: 8 }}>{label || 'View on Instagram'}</div>
      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>instagram.com ↗</div>
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
          if (ytId) {
            return <YouTubeEmbed key={i} videoId={ytId} label={h.label} />;
          }
          const igId = getInstagramPostId(h.url);
          if (igId) {
            return <InstagramEmbed key={i} url={h.url} label={h.label} />;
          }
          // Generic link card fallback
          return (
            <a key={i} href={h.url} target="_blank" rel="noopener noreferrer" className="highlight-card highlight-link-card" style={{ textDecoration: 'none', display: 'block' }}>
              <div className="highlight-label">{h.label || h.url}</div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Watch ↗</div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
