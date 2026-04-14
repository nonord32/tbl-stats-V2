'use client';
// src/components/LogoImage.tsx
// Client component wrapper for logo images so onError works in server pages

import { useState } from 'react';

interface LogoImageProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}

export function LogoImage({ src, alt, className, style }: LogoImageProps) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      onError={() => setHidden(true)}
    />
  );
}
