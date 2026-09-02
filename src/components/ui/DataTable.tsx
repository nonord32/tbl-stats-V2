'use client';
// src/components/ui/DataTable.tsx
//
// One sortable table for the whole site. Replaces five hand-rolled
// implementations that had drifted into four different header-cell styles:
// /advanced's two (identical bar an inverted ternary), the roster table's
// (different padding, tracking, active colour and arrow opacity), FightersClient's
// class-based legacy one, and TeamsClient's, which had no font styling at all.
//
// The canonical style is /advanced's, since that is the newest and the one the
// gazette pages already share. Callers that need the roster table's tighter
// padding pass `density="compact"`.
//
// Sorting is uncontrolled by default: give a `defaultSort` and the table owns
// the state. TeamsClient needs the sorted order for its own row decoration, so
// it can pass `onSortChange` and read it back.

import { Fragment, useMemo, useState } from 'react';

export type SortDir = 'asc' | 'desc';
export type Align = 'left' | 'right';

export interface Column<T> {
  /** stable key; also the sort key when `sortable` */
  key: string;
  label: string;
  align?: Align;
  /** tooltip on the header cell */
  title?: string;
  sortable?: boolean;
  /** the value to sort by. Omit for a display-only column. */
  value?: (row: T) => number | string;
  render: (row: T, index: number) => React.ReactNode;
  /** hide below the mobile breakpoint */
  hideOnMobile?: boolean;
  width?: number;
  /** sort this column ascending on first click (lower is better) */
  ascFirst?: boolean;
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  /** show a 1-based rank column at the left */
  rank?: boolean;
  defaultSort?: { key: string; dir: SortDir };
  onSortChange?: (key: string, dir: SortDir) => void;
  /** extra content rendered directly after a given row — the playoff cutoff line */
  renderAfterRow?: (row: T, index: number, colSpan: number) => React.ReactNode;
  emptyMessage?: React.ReactNode;
  density?: 'default' | 'compact';
  /** skip client-side sorting; rows are already in order (TeamsClient's record sort) */
  preSorted?: boolean;
}

const PAD = {
  default: { th: '7px 8px', td: '9px 8px', rankTh: '7px 4px', rankTd: '9px 4px', track: '0.14em' },
  compact: { th: '6px 6px', td: '7px 6px', rankTh: '6px 4px', rankTd: '7px 4px', track: '0.12em' },
};

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  rank = false,
  defaultSort,
  onSortChange,
  renderAfterRow,
  emptyMessage = 'Nothing to show.',
  density = 'default',
  preSorted = false,
}: Props<T>) {
  const [sortKey, setSortKey] = useState<string | null>(defaultSort?.key ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(defaultSort?.dir ?? 'desc');
  const pad = PAD[density];

  const handleSort = (col: Column<T>) => {
    let nextDir: SortDir;
    if (col.key === sortKey) {
      nextDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      nextDir = col.ascFirst ? 'asc' : 'desc';
      setSortKey(col.key);
    }
    setSortDir(nextDir);
    onSortChange?.(col.key, nextDir);
  };

  const sorted = useMemo(() => {
    if (preSorted || !sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.value) return rows;
    const out = [...rows];
    out.sort((a, b) => {
      const va = col.value!(a);
      const vb = col.value!(b);
      if (typeof va === 'string' || typeof vb === 'string') {
        const d = String(va).localeCompare(String(vb));
        return sortDir === 'asc' ? d : -d;
      }
      return sortDir === 'asc' ? va - vb : vb - va;
    });
    return out;
  }, [rows, columns, sortKey, sortDir, preSorted]);

  const colSpan = columns.length + (rank ? 1 : 0);

  const headStyle = (col: Column<T>): React.CSSProperties => ({
    textAlign: col.align ?? 'right',
    padding: pad.th,
    fontSize: 10,
    letterSpacing: pad.track,
    textTransform: 'uppercase',
    color: sortKey === col.key ? 'var(--tbl-accent)' : 'var(--tbl-ink-soft)',
    fontWeight: 700,
    cursor: col.sortable ? 'pointer' : undefined,
    userSelect: col.sortable ? 'none' : undefined,
    whiteSpace: 'nowrap',
    width: col.width,
  });

  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontFamily: 'var(--tbl-font-mono)',
            fontSize: 12,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <thead>
            <tr style={{ borderBottom: '2px solid var(--tbl-ink)' }}>
              {rank && (
                <th
                  style={{
                    width: 34,
                    textAlign: 'right',
                    padding: pad.rankTh,
                    fontSize: 10,
                    color: 'var(--tbl-ink-soft)',
                    fontWeight: 700,
                  }}
                >
                  #
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={col.hideOnMobile ? 'ui-col-hide-mobile' : undefined}
                  style={headStyle(col)}
                  title={col.title}
                  onClick={col.sortable ? () => handleSort(col) : undefined}
                  aria-sort={
                    col.sortable
                      ? sortKey === col.key
                        ? sortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                      : undefined
                  }
                >
                  {col.label}
                  {col.sortable && (
                    <span style={{ opacity: 0.9 }}>
                      {sortKey === col.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <Fragment key={rowKey(row)}>
                <tr style={{ borderBottom: '1px dotted rgba(20,17,11,0.3)' }}>
                  {rank && (
                    <td
                      style={{
                        textAlign: 'right',
                        padding: pad.rankTd,
                        color: 'var(--tbl-ink-mute)',
                        fontSize: 11,
                      }}
                    >
                      {i + 1}
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={col.hideOnMobile ? 'ui-col-hide-mobile' : undefined}
                      style={{ textAlign: col.align ?? 'right', padding: pad.td }}
                    >
                      {col.render(row, i)}
                    </td>
                  ))}
                </tr>
                {renderAfterRow?.(row, i, colSpan)}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length === 0 && (
        <p
          style={{
            fontFamily: 'var(--tbl-font-mono)',
            fontSize: 12,
            color: 'var(--tbl-ink-soft)',
            padding: '18px 0',
          }}
        >
          {emptyMessage}
        </p>
      )}
    </>
  );
}
