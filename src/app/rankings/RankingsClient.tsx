'use client';
// src/app/rankings/RankingsClient.tsx

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import type { FighterStat } from '@/types';
import { getTeamColorByName } from '@/lib/teams';

// Natural boxing weight-class order (lightest → heaviest)
const WEIGHT_ORDER = [
  '105', '108', '112', '115', '118', '122', '126', '130', '135',
  '140', '147', '154', '160', '168', '175', '200', 'heavyweight',
  "women's", "women's super",
];

function weightSortKey(w: string): number {
  const lower = w.toLowerCase();
  const idx = WEIGHT_ORDER.findIndex((o) => lower.includes(o));
  if (idx >= 0) return idx;
  const num = parseInt(w);
  return isNaN(num) ? 999 : num;
}

type Gender = 'Male' | 'Female';

interface Props {
  fighters: FighterStat[];
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

export function RankingsClient({ fighters, lastUpdated }: Props) {
  // Derive weight classes per gender
  const { maleWeights, femaleWeights } = useMemo(() => {
    const male = Array.from(new Set(
      fighters.filter((f) => f.gender?.toLowerCase() !== 'female').map((f) => f.weightClass).filter(Boolean)
    )).sort((a, b) => weightSortKey(a) - weightSortKey(b));

    const female = Array.from(new Set(
      fighters.filter((f) => f.gender?.toLowerCase() === 'female').map((f) => f.weightClass).filter(Boolean)
    )).sort((a, b) => weightSortKey(a) - weightSortKey(b));

    return { maleWeights: male, femaleWeights: female };
  }, [fighters]);

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
        return f.weightClass === activeWeight;
      })
      .sort((a, b) => b.netPts - a.netPts);
  }, [fighters, gender, activeWeight]);

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

          {/* Weight class tab strip */}
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
