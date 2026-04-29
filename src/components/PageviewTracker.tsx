'use client';
// src/components/PageviewTracker.tsx
// Fires a fire-and-forget POST to /api/track on every client-side navigation.
// Mounted once in the root layout so it covers the whole app.

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function PageviewTracker() {
  const path = usePathname();
  useEffect(() => {
    if (!path) return;
    if (path.startsWith('/admin') || path.startsWith('/auth/')) return;
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
      keepalive: true,
    }).catch(() => {
      // Network errors are intentionally swallowed — analytics is best-effort.
    });
  }, [path]);
  return null;
}
