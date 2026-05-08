'use client';
// src/app/compare/CompareClient.tsx
// Two fighter pickers backed by the URL. Selecting both updates
// /compare?a=…&b=… so the server view re-renders the comparison.

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FighterStat } from '@/types';

interface Props {
  fighters: FighterStat[];
  initialA: string;
  initialB: string;
}

export function CompareClient({ fighters, initialA, initialB }: Props) {
  const router = useRouter();
  const [a, setA] = useState(initialA);
  const [b, setB] = useState(initialB);

  const sortedFighters = useMemo(
    () => [...fighters].sort((x, y) => x.name.localeCompare(y.name)),
    [fighters]
  );

  function update(nextA: string, nextB: string) {
    setA(nextA);
    setB(nextB);
    if (nextA && nextB) {
      router.push(`/compare?a=${nextA}&b=${nextB}`);
    } else if (nextA) {
      router.push(`/compare?a=${nextA}`);
    } else if (nextB) {
      router.push(`/compare?b=${nextB}`);
    } else {
      router.push('/compare');
    }
  }

  return (
    <div className="cmp-pickers">
      <Picker
        label="Fighter A"
        value={a}
        otherValue={b}
        fighters={sortedFighters}
        onChange={(v) => update(v, b)}
      />
      <Picker
        label="Fighter B"
        value={b}
        otherValue={a}
        fighters={sortedFighters}
        onChange={(v) => update(a, v)}
      />
      {(a || b) && (
        <button
          type="button"
          className="cmp-pickers__clear"
          onClick={() => update('', '')}
        >
          Clear
        </button>
      )}
    </div>
  );
}

function Picker({
  label,
  value,
  otherValue,
  fighters,
  onChange,
}: {
  label: string;
  value: string;
  otherValue: string;
  fighters: FighterStat[];
  onChange: (slug: string) => void;
}) {
  return (
    <label className="cmp-picker">
      <span className="cmp-picker__label">{label}</span>
      <select
        className="cmp-picker__select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— Select fighter —</option>
        {fighters.map((f) => (
          <option key={f.slug} value={f.slug} disabled={f.slug === otherValue}>
            {f.name} · {f.team}
          </option>
        ))}
      </select>
    </label>
  );
}
