// src/app/wpa/page.tsx
// WPA (Win Probability Added) leaderboard. Values come from the versioned WPA
// model (see src/lib/wpa) — table lookups only at request time.
import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllData } from '@/lib/data';
import { getWpaData, WPA_MODEL_VERSION } from '@/lib/wpa';
import { WpaClient, type WpaRow } from './WpaClient';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Advanced Leaderboard — WPA, Leverage & Clutch',
  description:
    'TBL Win Probability Added: every round scored by how much it moved the team’s chance of winning the match. Sortable leaderboard of the fighters who swung the season.',
  openGraph: {
    url: 'https://tblstats.com/wpa',
    title: 'WPA Leaderboard | TBL Stats',
    description: 'Which fighters actually swung their team’s chances? Win Probability Added, round by round.',
  },
};

export default async function WpaPage() {
  const [data, season] = await Promise.all([getAllData(), getWpaData()]);

  // Team per fighter from the season roster (covers playoff-only fighters too).
  const teamBySlug = new Map(data.fighters.map((f) => [f.slug, f.team]));

  const rows: WpaRow[] = Array.from(season.byFighter.values()).map((f) => ({
    slug: f.slug,
    name: f.name,
    team: teamBySlug.get(f.slug) ?? '',
    matches: f.matches,
    rounds: f.rounds,
    roundWins: f.roundWins,
    wpa: f.wpa,
    wpaPerRound: f.rounds > 0 ? f.wpa / f.rounds : 0,
    avgLi: f.avgLi,
    liRounds: f.liRounds,
    clutch: f.clutch,
  }));

  return (
    <>
      <div style={{ padding: '22px 32px 0' }}>
        <div className="tbl-eyebrow">Advanced Stat · Model {WPA_MODEL_VERSION}</div>
        <div className="tbl-display" style={{ fontSize: 54, lineHeight: 0.95, marginTop: 4 }}>
          Advanced Leaderboard
        </div>
        <p
          style={{
            fontFamily: 'var(--tbl-font-mono)',
            fontSize: 12,
            lineHeight: 1.7,
            color: 'var(--tbl-ink-soft)',
            maxWidth: 640,
            margin: '14px 0 0',
          }}
        >
          <strong>WPA</strong> is how much a fighter changed their team&apos;s chance of
          winning. <strong>Avg Leverage</strong> is how much was at stake in the rounds they
          were put in — usage, not performance. <strong>Clutch</strong> is WPA minus what the
          same results were worth at average leverage. Sort by any column.{' '}
          <Link href="/stats/wpa" style={{ color: 'var(--tbl-accent)' }}>
            How WPA works →
          </Link>
          {'  ·  '}
          <Link href="/stats/leverage" style={{ color: 'var(--tbl-accent)' }}>
            Leverage &amp; Clutch →
          </Link>
          {'  ·  '}
          <Link href="/moments" style={{ color: 'var(--tbl-accent)' }}>
            Biggest moments →
          </Link>
        </p>
      </div>
      <WpaClient rows={rows} lastUpdated={data.lastUpdated} />
    </>
  );
}
