'use client';
// src/app/advanced/AdvancedClient.tsx
// The shell: page header, the three-view switcher, and whichever view is
// active. All three payloads arrive from the server, so switching is instant.
//
// Rounds is the landing view on purpose. Someone who wants the leaderboard
// knows to click for it; the feed is the only view that shows a first-time
// visitor what these numbers mean.

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { RoundsView } from './RoundsView';
import { FightersView } from './FightersView';
import { MatchesView } from './MatchesView';
import type { AdvancedMeta, FighterRow, MatchRow, RoundItem, StatSet, View } from './types';

const VIEW_LABELS: Record<View, string> = {
  rounds: 'Rounds',
  fighters: 'Fighters',
  matches: 'Matches',
};
const VIEW_ORDER: View[] = ['rounds', 'fighters', 'matches'];

const BLURBS: Record<View, React.ReactNode> = {
  rounds: (
    <>
      The rounds where the most was on the line. Every round of the season, ranked by how much was
      riding on it before the bell — 1.00 is an ordinary round, and 6.63 is as big as it gets: a
      tied match with one round to go.
    </>
  ),
  fighters: (
    <>
      Every fighter, ranked by whichever stat you pick. Some of these split by phase and some are
      whole-season only — the filters change to match.
    </>
  ),
  matches: (
    <>
      How close each winner came to losing. We take the winner&apos;s chance of victory after every
      round and find the lowest it ever fell.
    </>
  ),
};

export function AdvancedClient(props: Props) {
  // useSearchParams needs a Suspense boundary for the page to stay statically
  // prerendered; without it Next bails the whole route to dynamic rendering.
  return (
    <Suspense fallback={<AdvancedShell {...props} view="rounds" stat="wpa" />}>
      <AdvancedFromUrl {...props} />
    </Suspense>
  );
}

const VIEWS: View[] = ['rounds', 'fighters', 'matches'];
const STATS: StatSet[] = ['wpa', 'leverage', 'ratings', 'schedule', 'war'];

function AdvancedFromUrl(props: Props) {
  const params = useSearchParams();
  const v = params.get('view');
  const s = params.get('stat');
  return (
    <AdvancedShell
      {...props}
      view={VIEWS.includes(v as View) ? (v as View) : 'rounds'}
      stat={STATS.includes(s as StatSet) ? (s as StatSet) : 'wpa'}
    />
  );
}

interface Props {
  rounds: RoundItem[];
  fighters: FighterRow[];
  matches: MatchRow[];
  featured: MatchRow[];
  lastUpdated?: string;
  meta: AdvancedMeta;
}

function AdvancedShell({
  view: initialView,
  stat: initialStat,
  rounds,
  fighters,
  matches,
  featured,
  lastUpdated,
  meta,
}: Props & { view: View; stat: StatSet }) {
  const [view, setView] = useState<View>(initialView);

  return (
    <>
      <div style={{ padding: '22px 32px 0' }}>
        <div className="tbl-eyebrow">Advanced · Model {meta.modelVersion}</div>
        <h1 className="tbl-display" style={{ fontSize: 54, lineHeight: 0.95, margin: '4px 0 0' }}>
          Advanced Stats
        </h1>

        <div style={{ display: 'inline-flex', margin: '18px 0 0' }} role="tablist">
          {VIEW_ORDER.map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              className={`gz-seg__btn${view === v ? ' is-active' : ''}`}
              onClick={() => setView(v)}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>

        <p
          style={{
            fontFamily: 'var(--tbl-font-mono)',
            fontSize: 12,
            lineHeight: 1.7,
            color: 'var(--tbl-ink-soft)',
            maxWidth: 660,
            margin: '14px 0 0',
          }}
        >
          {BLURBS[view]}{' '}
          <Link href="/stats" style={{ color: 'var(--tbl-accent)' }}>
            What these mean →
          </Link>
        </p>
      </div>

      {view === 'rounds' && <RoundsView rounds={rounds} />}
      {view === 'fighters' && (
        <FightersView rows={fighters} initialStat={initialStat} lastUpdated={lastUpdated} meta={meta} />
      )}
      {view === 'matches' && (
        <MatchesView rows={matches} featured={featured} lastUpdated={lastUpdated} meta={meta} />
      )}
    </>
  );
}
