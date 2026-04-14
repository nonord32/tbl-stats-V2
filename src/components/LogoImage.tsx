'use client';

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
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      onError={() => setHidden(true)}
    />
  );
}
