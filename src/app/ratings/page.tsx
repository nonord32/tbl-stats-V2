// src/app/ratings/page.tsx
// Opponent-adjusted ratings leaderboard: Adjusted NPPR and Strength of
// Schedule. Both come from the versioned ratings model (see src/lib/ratings) —
// full season only, no phase split.
import type { Metadata } from 'next';
import Link from 'next/link';
import { getRatingsData, RATINGS_MODEL, RATINGS_MODEL_VERSION } from '@/lib/ratings';
import { RatingsClient, type RatingsRow } from './RatingsClient';
import { getAllData } from '@/lib/data';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Adjusted NPPR & Strength of Schedule',
  description:
    'TBL ratings that account for who a fighter actually faced. Adjusted NPPR solves every fighter’s rating simultaneously across all 1,313 rounds; Strength of Schedule averages opponent quality with all head-to-head rounds excluded.',
  openGraph: {
    url: 'https://tblstats.com/ratings',
    title: 'Adjusted NPPR & Strength of Schedule | TBL Stats',
    description:
      'Every other stat treats beating the best fighter the same as beating the worst. These two do not.',
  },
};

export default async function RatingsPage() {
  const [data, season] = await Promise.all([getAllData(), getRatingsData()]);

  const rows: RatingsRow[] = season.ranked.map((f) => ({
    slug: f.slug,
    name: f.name,
    team: f.team,
    weightClass: f.weightClass,
    gender: f.gender,
    rounds: f.rounds,
    nppr: f.nppr,
    sos: f.sos,
    anppr: f.anppr,
    delta: f.delta,
    bootSd: f.bootSd,
    lo: f.lo,
    hi: f.hi,
    uncertain: f.uncertain,
  }));

  const { summary } = season;

  return (
    <>
      <div style={{ padding: '22px 32px 0' }}>
        <div className="tbl-eyebrow">Advanced Stat · Model {RATINGS_MODEL_VERSION}</div>
        <div className="tbl-display" style={{ fontSize: 54, lineHeight: 0.95, marginTop: 4 }}>
          Adjusted Ratings
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
          Beating the best fighter in the league is harder than beating the worst. These two stats
          are the only ones here that know the difference.
          <br />
          <br />
          <strong>Adjusted NPPR</strong> rates every fighter against each other at once, across all{' '}
          {summary.pairedRounds.toLocaleString()} rounds of the season.{' '}
          <strong>Schedule</strong> is how good the opponents were that a fighter had to face.
          <br />
          <br />
          <strong>
            Gaps under {RATINGS_MODEL.meaningfulDiff.toFixed(2)} do not mean anything
          </strong>{' '}
          — a fighter three spots higher is often not better. Every rating shows its range.{' '}
          <Link href="/stats/ratings" style={{ color: 'var(--tbl-accent)' }}>
            How it works →
          </Link>
          {'  ·  '}
          <Link href="/wpa" style={{ color: 'var(--tbl-accent)' }}>
            WPA leaderboard →
          </Link>
        </p>
      </div>
      <RatingsClient
        rows={rows}
        lastUpdated={data.lastUpdated}
        minRounds={RATINGS_MODEL.minRounds}
        meaningfulDiff={RATINGS_MODEL.meaningfulDiff}
        flagBootSd={RATINGS_MODEL.flagBootSd}
      />
    </>
  );
}
