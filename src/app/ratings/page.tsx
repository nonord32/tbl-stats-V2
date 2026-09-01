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
          Net points per round says nothing about who you fought.{' '}
          <strong>Adjusted NPPR</strong> solves for every fighter&apos;s rating at once across all{' '}
          {summary.pairedRounds.toLocaleString()} rounds, so beating the best in the league counts
          for more than beating the worst. <strong>Strength of Schedule</strong> is the average NPPR
          of the opponents a fighter faced — with every head-to-head round removed, so nobody is
          punished for being good.
          <br />
          <br />
          Ratings carry about {summary.signalToNoise.toFixed(1)}× as much signal as noise.{' '}
          <strong>Differences under {RATINGS_MODEL.meaningfulDiff.toFixed(2)} are not
          meaningful</strong> — a fighter three spots higher is frequently not better.{' '}
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
