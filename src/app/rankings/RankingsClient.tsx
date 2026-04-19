'use client';
// src/app/rankings/RankingsClient.tsx

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import type { FighterStat, FightHistory } from '@/types';
import { getTeamColorByName } from '@/lib/teams';

// ─── Weight class sort ────────────────────────────────────────────────────────
// Handles both numeric names ("118", "118 lbs") and named classes
// ("Super Bantamweight", "Light Heavyweight", "Women's Flyweight", etc.)
function weightSortKey(w: string): number {
  if (!w) return 999;
  // Extract the first number — covers "118", "118 lbs", "Super 118 lbs"
  const numMatch = w.match(/\d+/);
  if (numMatch) {
    const n = parseInt(numMatch[0]);
    if (n >= 95 && n <= 250) return n; // sanity check: valid boxing weight
  }
  const lower = w.toLowerCase();
  // Named classes in ascending weight order
  if (lower.includes('straw') || lower.includes('minimum') || lower.includes('mini fly')) return 105;
  if (lower.includes('light fly'))   return 108;
  if (lower.includes('super fly') || (lower.includes('jr') && lower.includes('bant'))) return 115;
  if (lower.includes('fly'))         return 112;
  if (lower.includes('super bant') || (lower.includes('jr') && lower.includes('feath'))) return 122;
  if (lower.includes('bant'))        return 118;
  if (lower.includes('super feath') || (lower.includes('jr') && lower.includes('light'))) return 130;
  if (lower.includes('feath'))       return 126;
  if (lower.includes('super light') || (lower.includes('jr') && lower.includes('welt'))) return 140;
  if (lower.includes('light'))       return 135;
  if (lower.includes('super welt') || (lower.includes('jr') && lower.includes('mid'))) return 154;
  if (lower.includes('welt'))        return 147;
  if (lower.includes('super mid') || lower.includes('super middle')) return 168;
  if (lower.includes('mid'))         return 160;
  if (lower.includes('light heavy')) return 175;
  if (lower.includes('cruiser'))     return 200;
  if (lower.includes('heavy'))       return 210;
  return 999;
}

type Gender = 'Male' | 'Female';

interface Props {
  fighters: FighterStat[];
  fighterHistory: Record<string, FightHistory[]>;
  lastUpdated?: string;
}

function TabStrip({ weights, active, onChange }: { weights: string[]; active: string; onChange: (w: string) => void }) {
  return (
    <div className="rankings-tab-strip" style={{
      display: 'flex',
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-card)',
    }}>
      {weights.map((w) => {
        const isActive = w === active;
        return (
          <button
            key={w}
            onClick={() => onChange(w)}
            style={{
              flexShrink: 0,
              padding: '10px 16px',
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 12,
              fontWeight: isActive ? 700 : 400,
              color: isActive ? 'var(--accent)' : 'var(--text-muted)',
              background: 'none',
              border: 'none',
              borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'color 0.15s',
              marginBottom: -1,
            }}
          >
            {w}
          </button>
        );
      })}
    </div>
  );
}

export function RankingsClient({ fighters, fighterHistory, lastUpdated }: Props) {
  // Build a map of slug → most recent weight class from fight history.
  // Falls back to the profile weight class if no history exists.
  const currentWeightClass = useMemo(() => {
    const map = new Map<string, string>();
    for (const [slug, history] of Object.entries(fighterHistory)) {
      if (!history.length) continue;
      // fighterHistory is already sorted desc by date — first entry is most recent
      const wc = history[0].weightClass;
      if (wc) map.set(slug, wc);
    }
    return map;
  }, [fighterHistory]);

  // Effective weight class for a fighter (most recent fight > profile sheet)
  const effectiveWC = (f: FighterStat) => currentWeightClass.get(f.slug) || f.weightClass;

  // Derive per-gender weight class lists, sorted lightest → heaviest
  const { maleWeights, femaleWeights } = useMemo(() => {
    const male = Array.from(new Set(
      fighters
        .filter((f) => f.gender?.toLowerCase() !== 'female')
        .map((f) => effectiveWC(f))
        .filter(Boolean)
    )).sort((a, b) => weightSortKey(a) - weightSortKey(b));

    const female = Array.from(new Set(
      fighters
        .filter((f) => f.gender?.toLowerCase() === 'female')
        .map((f) => effectiveWC(f))
        .filter(Boolean)
    )).sort((a, b) => weightSortKey(a) - weightSortKey(b));

    return { maleWeights: male, femaleWeights: female };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fighters, currentWeightClass]);

  const [gender, setGender] = useState<Gender>('Male');
  const [maleWeight, setMaleWeight] = useState(maleWeights[0] || '');
  const [femaleWeight, setFemaleWeight] = useState(femaleWeights[0] || '');

  const activeWeight = gender === 'Male' ? maleWeight : femaleWeight;
  const activeWeights = gender === 'Male' ? maleWeights : femaleWeights;

  const handleWeightChange = (w: string) => {
    if (gender === 'Male') setMaleWeight(w);
    else setFemaleWeight(w);
  };

  const ranked = useMemo(() => {
    return fighters
      .filter((f) => {
        const isFemale = f.gender?.toLowerCase() === 'female';
        if (gender === 'Male' && isFemale) return false;
        if (gender === 'Female' && !isFemale) return false;
        return effectiveWC(f) === activeWeight;
      })
      .sort((a, b) => b.netPts - a.netPts);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fighters, gender, activeWeight, currentWeightClass]);

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <h1>Rankings</h1>
          <div className="subtitle">
            By Weight Class · 2026 TBL Season
            {lastUpdated && (
              <span style={{ marginLeft: 10, fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                · Updated {lastUpdated}
              </span>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Gender toggle */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-table-alt)',
            padding: '10px 16px',
            gap: 8,
          }}>
            {(['Male', 'Female'] as Gender[]).map((g) => (
              <button
                key={g}
                onClick={() => setGender(g)}
                style={{
                  padding: '5px 18px',
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 20,
                  border: gender === g ? 'none' : '1px solid var(--border)',
                  background: gender === g ? 'var(--accent)' : 'transparent',
                  color: gender === g ? '#fff' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  letterSpacing: '0.04em',
                }}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Weight class tabs — lightest left, heaviest right */}
          <TabStrip
            weights={activeWeights}
            active={activeWeight}
            onChange={handleWeightChange}
          />

          {/* Table */}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 32 }}>#</th>
                  <th className="always-show">Fighter</th>
                  <th className="col-hide-mobile">Team</th>
                  <th className="num-cell col-record">Record</th>
                  <th className="num-cell col-war">Net Pts</th>
                  <th className="num-cell col-hide-mobile">NPPR</th>
                  <th className="num-cell col-hide-mobile">Win%</th>
                  <th className="num-cell col-hide-mobile">WAR</th>
                </tr>
              </thead>
              <tbody>
                {ranked.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
                      No fighters in this weight class
                    </td>
                  </tr>
                ) : (
                  ranked.map((f, i) => (
                    <tr key={f.slug}>
                      <td className="rank-cell">{i + 1}</td>
                      <td className="always-show">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {getTeamColorByName(f.team) && (
                            <span style={{
                              display: 'inline-block',
                              width: 3,
                              height: 22,
                              borderRadius: 2,
                              background: getTeamColorByName(f.team),
                              flexShrink: 0,
                            }} />
                          )}
                          <div>
                            <Link href={`/fighters/${f.slug}`} className="fighter-name-btn">
                              {f.name}
                            </Link>
                            <div className="fighter-team-sub">{f.team}</div>
                          </div>
                        </div>
                      </td>
                      <td className="col-hide-mobile" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{f.team}</td>
                      <td className="num-cell mono col-record">{f.record}</td>
                      <td className="num-cell mono col-war" style={{ color: f.netPts >= 0 ? 'var(--result-w)' : 'var(--result-l)', fontWeight: 600 }}>
                        {f.netPts >= 0 ? '+' : ''}{f.netPts.toFixed(1)}
                      </td>
                      <td className="num-cell mono col-hide-mobile">{f.nppr.toFixed(3)}</td>
                      <td className="num-cell mono col-hide-mobile">{(f.winPct * 100).toFixed(1)}%</td>
                      <td className="num-cell mono col-hide-mobile">{f.war.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '8px 20px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
            {ranked.length} fighter{ranked.length !== 1 ? 's' : ''} · {gender} · {activeWeight} · Sorted by Net Points
          </div>
        </div>
      </div>
    </div>
  );
}
