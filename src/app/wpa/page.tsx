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
  title: 'WPA Leaderboard — Win Probability Added',
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
  }));

  return (
    <>
      <div style={{ padding: '22px 32px 0' }}>
        <div className="tbl-eyebrow">Advanced Stat · Model {WPA_MODEL_VERSION}</div>
        <div className="tbl-display" style={{ fontSize: 54, lineHeight: 0.95, marginTop: 4 }}>
          Win Probability Added
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
          Every round moves a team&apos;s chance of winning the match. WPA is that change,
          credited to the fighter who caused it — a round won with the match on the line is
          worth far more than a round won in a blowout.{' '}
          <Link href="/stats/wpa" style={{ color: 'var(--tbl-accent)' }}>
            How WPA works →
          </Link>
        </p>
      </div>
      <WpaClient rows={rows} lastUpdated={data.lastUpdated} />
    </>
  );
}
