'use client';
// Scroll effects for Gazette pages, driven by data attributes in the markup:
//
//   data-fx="reveal"   the block fades up as it scrolls into view
//   data-fx="stagger"  its children fade up one after another
//   data-fx="rule"     a double rule (see .fx-rule) inks itself left to right
//   data-countup       a number like "+42", "61%" or "3.25" counts up from 0
//
// Pages that aren't hand-tagged still get the effects: autoTag() marks the
// shared Gazette structures (table rows, card lists, section rules, headings,
// inline double rules, big Playfair numbers). Put data-fx-off on a subtree to
// keep it still.
//
// Everything animates once per page load. Pages render normally on the server
// and without JS; only blocks that start below the fold are ever hidden, and
// nothing moves when the visitor prefers reduced motion. Count-ups only change
// the text node values React rendered and put the originals back at the end,
// so React's own references to those nodes stay valid.
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { fxEnabled } from './rollout';

const STAGGER_MS = 45;
const STAGGER_MAX = 8; // later children share the last delay
const COUNT_MS = 700;
const REVEAL_MS = 900; // longest reveal transition (the rule draw) plus slack
const NUMBER = /^([+\-−]?)(\d+(?:\.\d+)?)(%?)$/;

// Cards that sit in lists and stagger in with their siblings.
const AUTO_ITEMS = [
  'tbody > tr',
  '.gz-game-card',
  '.results-card',
  '.teams-mobile-row',
  '.highlight-card',
  '.po-card',
  '.lb-card',
].join(', ');
const AUTO_REVEAL = '.tbl-section-rule, h2';
const AUTO_RULE = '[style*="border-bottom:3px double"]';
const AUTO_COUNT = '.tbl-display';

// Opted out, or already inside something that moves (rules don't move).
function skip(el: Element): boolean {
  return (
    !!el.closest('[data-fx-off]') ||
    !!el.parentElement?.closest('[data-fx="reveal"], [data-fx="stagger"]')
  );
}

// A year ("2026") or a padded rank ("01") shouldn't tick up like a stat.
function countable(el: Element): boolean {
  const t = (el.textContent ?? '').trim();
  if (!NUMBER.test(t) || /^0\d/.test(t)) return false;
  const n = Number(t);
  return !(Number.isInteger(n) && n >= 1900 && n <= 2100);
}

// Tags untagged pages. Only touches elements below the fold, so nothing the
// visitor can already see changes.
function autoTag(main: HTMLElement) {
  main.querySelectorAll<HTMLElement>(AUTO_ITEMS).forEach((el) => {
    // A card wrapped in a link staggers as the link.
    let item: HTMLElement = el;
    while (item.parentElement?.tagName === 'A') item = item.parentElement;
    const group = item.parentElement;
    if (!group || group.dataset.fx || skip(group) || !belowFold(item)) return;
    group.dataset.fx = 'stagger';
  });
  main.querySelectorAll<HTMLElement>(AUTO_RULE).forEach((el) => {
    if (el.dataset.fx || skip(el) || !belowFold(el)) return;
    el.dataset.fx = 'rule';
    el.dataset.fxAutorule = '';
  });
  main.querySelectorAll<HTMLElement>(AUTO_REVEAL).forEach((el) => {
    if (el.dataset.fx || skip(el) || el.closest('[data-fx="stagger"]')) return;
    if (belowFold(el)) el.dataset.fx = 'reveal';
  });
  main.querySelectorAll<HTMLElement>(AUTO_COUNT).forEach((el) => {
    if (el.hasAttribute('data-countup') || el.closest('[data-fx-off]')) return;
    if (belowFold(el) && countable(el)) el.setAttribute('data-countup', '');
  });
}

function belowFold(el: Element): boolean {
  return el.getBoundingClientRect().top > window.innerHeight;
}

// Prepares a count-up: returns a runner, or null if the text isn't a number.
function prepareCount(el: HTMLElement): (() => void) | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  if (nodes.length === 0) return null;
  const originals = nodes.map((n) => n.nodeValue ?? '');
  const m = originals.join('').trim().match(NUMBER);
  if (!m) return null;
  const [, sign, digits, pct] = m;
  const target = parseFloat(digits);
  const decimals = digits.includes('.') ? digits.split('.')[1].length : 0;
  const show = (v: number) => {
    nodes[0].nodeValue = `${sign}${v.toFixed(decimals)}${pct}`;
    for (let i = 1; i < nodes.length; i++) nodes[i].nodeValue = '';
  };
  const restore = () => nodes.forEach((n, i) => (n.nodeValue = originals[i]));

  show(0);
  return () => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_MS);
      if (t >= 1) return restore();
      show(target * (1 - Math.pow(1 - t, 3))); // ease-out cubic
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
}

export function ScrollFx() {
  const pathname = usePathname() || '/';

  useEffect(() => {
    if (!fxEnabled(pathname)) return;
    if (typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const onEnter = new Map<Element, () => void>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          io.unobserve(e.target);
          onEnter.get(e.target)?.();
          onEnter.delete(e.target);
        }
      },
    );
    // Safety net: at the end of the page, anything still waiting runs now, so
    // nothing near the bottom can be left hidden.
    const flushAtEnd = () => {
      const doc = document.documentElement;
      if (window.innerHeight + window.scrollY < doc.scrollHeight - 2) return;
      onEnter.forEach((run) => run());
      onEnter.clear();
      io.disconnect();
    };
    window.addEventListener('scroll', flushAtEnd, { passive: true });
    const watch = (el: Element, run: () => void) => {
      onEnter.set(el, run);
      io.observe(el);
    };
    const timers: number[] = [];
    const pend = (el: HTMLElement, delayMs = 0) => {
      el.dataset.fxState = 'pending';
      watch(el, () => {
        el.dataset.fxState = 'in';
        // Once it has landed, drop the state so hover styles behave normally.
        timers.push(
          window.setTimeout(() => {
            delete el.dataset.fxState;
            el.style.removeProperty('--fx-delay');
          }, REVEAL_MS + delayMs),
        );
      });
    };

    // Wait a frame so a freshly navigated page has committed its markup.
    const raf = requestAnimationFrame(() => {
      const main = document.querySelector('main');
      if (main) autoTag(main);
      document.querySelectorAll<HTMLElement>('[data-fx="reveal"], [data-fx="rule"]').forEach((el) => {
        if (belowFold(el)) pend(el);
      });
      document.querySelectorAll<HTMLElement>('[data-fx="stagger"]').forEach((group) => {
        let i = 0;
        Array.from(group.children).forEach((child) => {
          if (!(child instanceof HTMLElement) || !belowFold(child)) return;
          const delay = Math.min(i++, STAGGER_MAX) * STAGGER_MS;
          child.style.setProperty('--fx-delay', `${delay}ms`);
          pend(child, delay);
        });
      });
      document.querySelectorAll<HTMLElement>('[data-countup]').forEach((el) => {
        if (!belowFold(el)) return;
        const run = prepareCount(el);
        if (run) watch(el, run);
      });
    });

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      window.removeEventListener('scroll', flushAtEnd);
      io.disconnect();
    };
  }, [pathname]);

  return null;
}
