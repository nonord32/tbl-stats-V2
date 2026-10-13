'use client';
// Fades its children in the first time they scroll into view. Content renders
// visible on the server and stays visible without JS; only blocks that start
// below the fold get hidden, and never when the visitor prefers reduced motion.
import { useEffect, useRef, useState, type ReactNode } from 'react';

type State = 'static' | 'hidden' | 'shown';

export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>('static');

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return; // already on screen

    setState('hidden');
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState('shown');
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`hm-reveal${className ? ` ${className}` : ''}`} data-reveal={state}>
      {children}
    </div>
  );
}
