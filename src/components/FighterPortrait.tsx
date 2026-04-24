'use client';

import { useState } from 'react';

interface FighterPortraitProps {
  slug: string;
  teamLogoSrc: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}

// Tries /fighters/{slug}.avif first; falls back to the team logo if the
// portrait file doesn't exist; hides entirely if neither loads.
export function FighterPortrait({ slug, teamLogoSrc, alt, className, style }: FighterPortraitProps) {
  const portraitSrc = `/fighters/${slug}.avif`;
  const [src, setSrc] = useState(portraitSrc);
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      onError={() => {
        if (src === portraitSrc) setSrc(teamLogoSrc);
        else setHidden(true);
      }}
    />
  );
}
