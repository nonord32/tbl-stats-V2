'use client';
// src/app/admin/cards/CardsAdminClient.tsx
// Internal admin UI for assembling the four weekly IG cards.
// - Style A (Gazette) / Style B (Neon) toggle, persisted to localStorage
// - Live preview of the currently active card at its real 400×400 size
// - Inline editing of every field
// - PNG download (1200×1200 via pixelRatio: 3) per card or all four as a zip

import { useEffect, useRef, useState } from 'react';
import GazetteCard1 from '@/components/cards/gazette/Card1';
import GazetteCard2 from '@/components/cards/gazette/Card2';
import GazetteCard3 from '@/components/cards/gazette/Card3';
import GazetteCard4 from '@/components/cards/gazette/Card4';
import NeonCard1 from '@/components/cards/neon/Card1';
import NeonCard2 from '@/components/cards/neon/Card2';
import NeonCard3 from '@/components/cards/neon/Card3';
import NeonCard4 from '@/components/cards/neon/Card4';
import type {
  Card1Data,
  Card2Data,
  Card3Data,
  Card4Data,
  CardsPayload,
  CardStyle,
  FinishMethod,
} from '@/components/cards/shared';

const STYLE_KEY = 'admin-cards-style';

const EMPTY: CardsPayload = {
  week: 1,
  card1: { week: 1, fighters: [] },
  card2: { fighters: [] },
  card3: { fighters: [] },
  card4: {
    week: 1,
    a: { name: '', team: '', record: '0-0', netPts: 0, roundWinPct: 0, last3: [] },
    b: { name: '', team: '', record: '0-0', netPts: 0, roundWinPct: 0, last3: [] },
  },
};

export function CardsAdminClient() {
  const [secret, setSecret] = useState('');
  const [authed, setAuthed] = useState(false);

  const [style, setStyle] = useState<CardStyle>('A');
  const [activeCard, setActiveCard] = useState<1 | 2 | 3 | 4>(1);
  const [data, setData] = useState<CardsPayload>(EMPTY);
  const [pulling, setPulling] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  // Restore persisted style on mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STYLE_KEY);
      if (saved === 'A' || saved === 'B') setStyle(saved);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STYLE_KEY, style);
    } catch {}
  }, [style]);

  async function pullLatest() {
    setPulling(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/admin/cards/latest', {
        headers: { Authorization: `Bearer ${secret}` },
        cache: 'no-store',
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error || `Fetch failed (${res.status})`);
      }
      const json = (await res.json()) as CardsPayload;
      setData(json);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load cards.');
    } finally {
      setPulling(false);
    }
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!secret.trim()) return;
    setAuthed(true);
    // Kick off the initial fetch right after auth.
    setTimeout(() => pullLatest(), 0);
  }

  if (!authed) {
    return (
      <main style={loginWrap}>
        <div style={loginCard}>
          <h1 style={loginTitle}>Admin · Cards</h1>
          <p style={loginSub}>Enter the admin secret to load the weekly cards.</p>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="password"
              placeholder="Admin secret"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              style={loginInput}
              autoFocus
            />
            <button type="submit" style={btnPrimary}>
              Enter
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <CardsAdminBody
      secret={secret}
      style={style}
      setStyle={setStyle}
      activeCard={activeCard}
      setActiveCard={setActiveCard}
      data={data}
      setData={setData}
      pullLatest={pullLatest}
      pulling={pulling}
      fetchError={fetchError}
      exporting={exporting}
      setExporting={setExporting}
    />
  );
}

// ─── Authed body ─────────────────────────────────────────────────────────────
function CardsAdminBody({
  style,
  setStyle,
  activeCard,
  setActiveCard,
  data,
  setData,
  pullLatest,
  pulling,
  fetchError,
  exporting,
  setExporting,
}: {
  secret: string;
  style: CardStyle;
  setStyle: (s: CardStyle) => void;
  activeCard: 1 | 2 | 3 | 4;
  setActiveCard: (n: 1 | 2 | 3 | 4) => void;
  data: CardsPayload;
  setData: (d: CardsPayload) => void;
  pullLatest: () => void;
  pulling: boolean;
  fetchError: string | null;
  exporting: string | null;
  setExporting: (s: string | null) => void;
}) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const hiddenRefs = [
    useRef<HTMLDivElement | null>(null),
    useRef<HTMLDivElement | null>(null),
    useRef<HTMLDivElement | null>(null),
    useRef<HTMLDivElement | null>(null),
  ];

  async function exportPng(node: HTMLElement, filename: string) {
    const { toPng } = await import('html-to-image');
    const dataUrl = await toPng(node, {
      width: 400,
      height: 400,
      pixelRatio: 3,
      cacheBust: true,
    });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function exportPngBlob(node: HTMLElement): Promise<Blob> {
    const { toBlob } = await import('html-to-image');
    const blob = await toBlob(node, {
      width: 400,
      height: 400,
      pixelRatio: 3,
      cacheBust: true,
    });
    if (!blob) throw new Error('PNG render returned empty blob');
    return blob;
  }

  async function downloadCurrent() {
    const node = previewRef.current;
    if (!node) return;
    setExporting('single');
    try {
      await exportPng(node, `tbl-wk${data.week}-card${activeCard}.png`);
    } catch (err) {
      console.error('[admin/cards] PNG export failed', err);
    } finally {
      setExporting(null);
    }
  }

  async function downloadAllZip() {
    setExporting('zip');
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      for (let i = 0; i < 4; i++) {
        const node = hiddenRefs[i].current;
        if (!node) continue;
        const blob = await exportPngBlob(node);
        zip.file(`tbl-wk${data.week}-card${i + 1}.png`, blob);
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tbl-wk${data.week}-cards-${style === 'A' ? 'gazette' : 'neon'}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[admin/cards] zip export failed', err);
    } finally {
      setExporting(null);
    }
  }

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('[admin/cards] clipboard write failed', err);
    }
  }

  const card1List = [
    { n: 1 as const, title: 'Top Performers', sub: `Week ${data.week} · ${data.card1.fighters.length} fighters` },
    { n: 2 as const, title: 'Hot Streak', sub: 'Last 5 fights' },
    { n: 3 as const, title: 'Finish Rate Leaders', sub: `${data.card3.fighters.length} ranked` },
    { n: 4 as const, title: 'Tale of the Tape', sub: `Week ${data.card4.week} head to head` },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#14110b', color: '#f4ede0' }}>
      {/* Top admin bar */}
      <div style={topBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em' }}>
            TBLStats <span style={{ color: '#c43a00' }}>· Admin</span>
          </div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#8d8273', letterSpacing: '0.18em' }}>
            tblstats.com/admin/cards
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', background: '#1f1a14', borderRadius: 8, padding: 3 }}>
            {(['A', 'B'] as CardStyle[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStyle(s)}
                style={{
                  ...styleTab,
                  background: style === s ? '#c43a00' : 'transparent',
                  color: style === s ? '#fff' : '#8d8273',
                }}
              >
                STYLE {s}
              </button>
            ))}
          </div>
          <button type="button" onClick={pullLatest} style={btnGhost} disabled={pulling}>
            {pulling ? 'Pulling…' : '↓ Pull latest week'}
          </button>
        </div>
      </div>

      {fetchError && (
        <div style={errorBar}>
          {fetchError}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', minHeight: 'calc(100vh - 60px)' }}>
        {/* Sidebar */}
        <div style={sidebar}>
          <div style={sidebarLabel}>Cards</div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {card1List.map((c) => (
              <button
                key={c.n}
                type="button"
                onClick={() => setActiveCard(c.n)}
                style={{
                  ...cardListBtn,
                  background: activeCard === c.n ? '#1f1a14' : 'transparent',
                  border: '1px solid ' + (activeCard === c.n ? '#3a3328' : 'transparent'),
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14 }}>
                    {c.title}
                  </div>
                  <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#8d8273' }}>
                    0{c.n}
                  </div>
                </div>
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#8d8273', letterSpacing: '0.1em', marginTop: 3 }}>
                  {c.sub}
                </div>
              </button>
            ))}
          </div>

          <div style={{ height: 1, background: '#2a2418', margin: '20px 0' }} />

          <div style={{ ...sidebarLabel, marginBottom: 10 }}>Edit · Card {activeCard}</div>

          {activeCard === 1 && (
            <Card1Form
              data={data.card1}
              week={data.week}
              setWeek={(w) => setData({ ...data, week: w, card1: { ...data.card1, week: w } })}
              setData={(d) => setData({ ...data, card1: d })}
            />
          )}
          {activeCard === 2 && (
            <Card2Form data={data.card2} setData={(d) => setData({ ...data, card2: d })} />
          )}
          {activeCard === 3 && (
            <Card3Form data={data.card3} setData={(d) => setData({ ...data, card3: d })} />
          )}
          {activeCard === 4 && (
            <Card4Form data={data.card4} setData={(d) => setData({ ...data, card4: d })} />
          )}
        </div>

        {/* Preview pane */}
        <div style={previewPane}>
          <div style={{ width: '100%', maxWidth: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#8d8273', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                Preview · 400 × 400
              </div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 20, fontWeight: 700, marginTop: 4 }}>
                Card {activeCard}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={copyJson} style={btnGhost}>
                Copy data JSON
              </button>
              <button type="button" onClick={downloadCurrent} style={btnPrimary} disabled={!!exporting}>
                {exporting === 'single' ? 'Rendering…' : '↓ Download PNG'}
              </button>
            </div>
          </div>

          <div style={previewFrame}>
            <div ref={previewRef}>
              <CardRender style={style} card={activeCard} data={data} />
            </div>
          </div>

          <div style={batchBox}>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#c43a00', letterSpacing: '0.18em', fontWeight: 700, marginBottom: 6 }}>
              BATCH ACTIONS
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#bfb5a3', marginBottom: 12 }}>
              Render all 4 cards in the current style and download as a ZIP, ready to post.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={downloadAllZip} style={btnPrimary} disabled={!!exporting}>
                {exporting === 'zip' ? 'Bundling…' : '↓ Download all 4 (PNG zip)'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Off-screen render targets so the zip exporter can grab a fully-painted
          node for each card without having to swap activeCard. */}
      <div
        aria-hidden
        style={{ position: 'fixed', left: -10000, top: 0, pointerEvents: 'none' }}
      >
        {[1, 2, 3, 4].map((n, i) => (
          <div key={n} ref={hiddenRefs[i]}>
            <CardRender style={style} card={n as 1 | 2 | 3 | 4} data={data} />
          </div>
        ))}
      </div>
    </div>
  );
}

function CardRender({
  style,
  card,
  data,
}: {
  style: CardStyle;
  card: 1 | 2 | 3 | 4;
  data: CardsPayload;
}) {
  if (style === 'A') {
    if (card === 1) return <GazetteCard1 data={data.card1} />;
    if (card === 2) return <GazetteCard2 data={data.card2} />;
    if (card === 3) return <GazetteCard3 data={data.card3} />;
    return <GazetteCard4 data={data.card4} />;
  }
  if (card === 1) return <NeonCard1 data={data.card1} />;
  if (card === 2) return <NeonCard2 data={data.card2} />;
  if (card === 3) return <NeonCard3 data={data.card3} />;
  return <NeonCard4 data={data.card4} />;
}

// ─── Inline form panels ──────────────────────────────────────────────────────
function Card1Form({
  data,
  week,
  setWeek,
  setData,
}: {
  data: Card1Data;
  week: number;
  setWeek: (n: number) => void;
  setData: (d: Card1Data) => void;
}) {
  function updateFighter(i: number, patch: Partial<Card1Data['fighters'][number]>) {
    const next = [...data.fighters];
    next[i] = { ...next[i], ...patch };
    setData({ ...data, fighters: next });
  }
  function addFighter() {
    setData({
      ...data,
      fighters: [...data.fighters, { name: '', team: '', pts: '+0.0', method: 'DEC' }],
    });
  }
  function removeFighter(i: number) {
    const next = [...data.fighters];
    next.splice(i, 1);
    setData({ ...data, fighters: next });
  }
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <span style={labelSm}>Week number</span>
        <input
          style={inputCss}
          type="number"
          value={week}
          onChange={(e) => setWeek(Number(e.target.value))}
        />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '24px 1fr 70px 70px 70px 24px',
          gap: 6,
          marginBottom: 6,
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: 9,
          color: '#8d8273',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        <div>#</div>
        <div>Name</div>
        <div>Team</div>
        <div>Pts</div>
        <div>Method</div>
        <div />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.fighters.map((f, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '24px 1fr 70px 70px 70px 24px',
              gap: 6,
              alignItems: 'center',
            }}
          >
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#8d8273' }}>
              {String(i + 1).padStart(2, '0')}
            </div>
            <input style={inputCss} value={f.name} onChange={(e) => updateFighter(i, { name: e.target.value })} />
            <input style={inputCss} value={f.team} onChange={(e) => updateFighter(i, { team: e.target.value })} />
            <input style={inputCss} value={f.pts} onChange={(e) => updateFighter(i, { pts: e.target.value })} />
            <select
              style={inputCss}
              value={f.method}
              onChange={(e) => updateFighter(i, { method: e.target.value as FinishMethod })}
            >
              <option value="KO">KO</option>
              <option value="TKO">TKO</option>
              <option value="DEC">DEC</option>
            </select>
            <button type="button" onClick={() => removeFighter(i)} style={removeBtn} title="Remove">
              ×
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addFighter} style={addBtn}>
        + Add fighter
      </button>
    </div>
  );
}

function Card2Form({ data, setData }: { data: Card2Data; setData: (d: Card2Data) => void }) {
  function updateFighter(i: number, patch: Partial<Card2Data['fighters'][number]>) {
    const next = [...data.fighters];
    next[i] = { ...next[i], ...patch };
    setData({ ...data, fighters: next });
  }
  function updatePoint(i: number, j: number, value: string) {
    const next = [...data.fighters];
    const pts = [...next[i].pts];
    pts[j] = Number(value);
    next[i] = { ...next[i], pts };
    setData({ ...data, fighters: next });
  }
  function addFighter() {
    setData({
      ...data,
      fighters: [...data.fighters, { name: '', team: '', pts: [0, 0, 0, 0, 0] }],
    });
  }
  function removeFighter(i: number) {
    const next = [...data.fighters];
    next.splice(i, 1);
    setData({ ...data, fighters: next });
  }
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.fighters.map((f, i) => (
          <div key={i} style={{ background: '#1f1a14', padding: 8, borderRadius: 6 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 24px', gap: 6, marginBottom: 6 }}>
              <input style={inputCss} value={f.name} onChange={(e) => updateFighter(i, { name: e.target.value })} placeholder="Name" />
              <input style={inputCss} value={f.team} onChange={(e) => updateFighter(i, { team: e.target.value })} placeholder="Team" />
              <button type="button" onClick={() => removeFighter(i)} style={removeBtn}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
              {f.pts.map((v, j) => (
                <input
                  key={j}
                  style={inputCss}
                  type="number"
                  step="0.1"
                  value={v}
                  onChange={(e) => updatePoint(i, j, e.target.value)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={addFighter} style={addBtn}>
        + Add fighter
      </button>
    </div>
  );
}

function Card3Form({ data, setData }: { data: Card3Data; setData: (d: Card3Data) => void }) {
  function updateFighter(i: number, patch: Partial<Card3Data['fighters'][number]>) {
    const next = [...data.fighters];
    next[i] = { ...next[i], ...patch };
    setData({ ...data, fighters: next });
  }
  function addFighter() {
    setData({
      ...data,
      fighters: [...data.fighters, { name: '', team: '', finishRate: 0, totalFights: 0 }],
    });
  }
  function removeFighter(i: number) {
    const next = [...data.fighters];
    next.splice(i, 1);
    setData({ ...data, fighters: next });
  }
  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '24px 1fr 60px 60px 50px 24px',
          gap: 6,
          marginBottom: 6,
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: 9,
          color: '#8d8273',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        <div>#</div>
        <div>Name</div>
        <div>Team</div>
        <div>Rate</div>
        <div>Fights</div>
        <div />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.fighters.map((f, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '24px 1fr 60px 60px 50px 24px',
              gap: 6,
              alignItems: 'center',
            }}
          >
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#8d8273' }}>
              {String(i + 1).padStart(2, '0')}
            </div>
            <input style={inputCss} value={f.name} onChange={(e) => updateFighter(i, { name: e.target.value })} />
            <input style={inputCss} value={f.team} onChange={(e) => updateFighter(i, { team: e.target.value })} />
            <input
              style={inputCss}
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={f.finishRate}
              onChange={(e) => updateFighter(i, { finishRate: Number(e.target.value) })}
            />
            <input
              style={inputCss}
              type="number"
              value={f.totalFights}
              onChange={(e) => updateFighter(i, { totalFights: Number(e.target.value) })}
            />
            <button type="button" onClick={() => removeFighter(i)} style={removeBtn}>×</button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addFighter} style={addBtn}>
        + Add fighter
      </button>
    </div>
  );
}

function Card4Form({ data, setData }: { data: Card4Data; setData: (d: Card4Data) => void }) {
  function updateSide(side: 'a' | 'b', patch: Partial<Card4Data['a']>) {
    setData({ ...data, [side]: { ...data[side], ...patch } });
  }
  function setLast3(side: 'a' | 'b', i: number, v: 'w' | 'l') {
    const next = [...data[side].last3];
    next[i] = v;
    updateSide(side, { last3: next });
  }
  function addLast3(side: 'a' | 'b') {
    if (data[side].last3.length >= 3) return;
    updateSide(side, { last3: [...data[side].last3, 'w'] });
  }
  function removeLast3(side: 'a' | 'b') {
    updateSide(side, { last3: data[side].last3.slice(0, -1) });
  }

  function SidePanel({ side, label }: { side: 'a' | 'b'; label: string }) {
    const s = data[side];
    return (
      <div style={{ background: '#1f1a14', padding: 10, borderRadius: 6 }}>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: '#c43a00', letterSpacing: '0.18em', fontWeight: 700, marginBottom: 8 }}>
          {label}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div>
            <span style={labelSm}>Name</span>
            <input style={inputCss} value={s.name} onChange={(e) => updateSide(side, { name: e.target.value })} />
          </div>
          <div>
            <span style={labelSm}>Team</span>
            <input style={inputCss} value={s.team} onChange={(e) => updateSide(side, { team: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            <div>
              <span style={labelSm}>Record</span>
              <input style={inputCss} value={s.record} onChange={(e) => updateSide(side, { record: e.target.value })} />
            </div>
            <div>
              <span style={labelSm}>Net pts</span>
              <input
                style={inputCss}
                type="number"
                step="0.1"
                value={s.netPts}
                onChange={(e) => updateSide(side, { netPts: Number(e.target.value) })}
              />
            </div>
            <div>
              <span style={labelSm}>Round %</span>
              <input
                style={inputCss}
                type="number"
                value={s.roundWinPct}
                onChange={(e) => updateSide(side, { roundWinPct: Number(e.target.value) })}
              />
            </div>
          </div>
          <div>
            <span style={labelSm}>Last 3</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {s.last3.map((r, i) => (
                <select
                  key={i}
                  style={{ ...inputCss, width: 50 }}
                  value={r}
                  onChange={(e) => setLast3(side, i, e.target.value as 'w' | 'l')}
                >
                  <option value="w">W</option>
                  <option value="l">L</option>
                </select>
              ))}
              <button type="button" onClick={() => addLast3(side)} style={addBtnSm} disabled={s.last3.length >= 3}>+</button>
              <button type="button" onClick={() => removeLast3(side)} style={addBtnSm} disabled={s.last3.length === 0}>−</button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <span style={labelSm}>Week number</span>
        <input
          style={inputCss}
          type="number"
          value={data.week}
          onChange={(e) => setData({ ...data, week: Number(e.target.value) })}
        />
      </div>
      <SidePanel side="a" label="SIDE A" />
      <SidePanel side="b" label="SIDE B" />
    </div>
  );
}

// ─── Styles (inline so the page doesn't depend on globals.css) ───────────────
const topBar: React.CSSProperties = {
  background: '#0d0a06',
  borderBottom: '1px solid #2a2418',
  padding: '14px 28px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  position: 'sticky',
  top: 0,
  zIndex: 10,
};
const styleTab: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'Inter, sans-serif',
  fontSize: 12,
  fontWeight: 700,
  border: 'none',
};
const sidebar: React.CSSProperties = {
  background: '#0d0a06',
  borderRight: '1px solid #2a2418',
  padding: '20px 18px',
  overflowY: 'auto',
};
const sidebarLabel: React.CSSProperties = {
  fontFamily: 'IBM Plex Mono, monospace',
  fontSize: 10,
  color: '#8d8273',
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  fontWeight: 600,
};
const cardListBtn: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  cursor: 'pointer',
  textAlign: 'left',
  color: '#f4ede0',
};
const previewPane: React.CSSProperties = {
  padding: 32,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 24,
};
const previewFrame: React.CSSProperties = {
  padding: 28,
  background: '#0d0a06',
  borderRadius: 16,
  border: '1px solid #2a2418',
};
const batchBox: React.CSSProperties = {
  width: '100%',
  maxWidth: 700,
  padding: 18,
  background: '#0d0a06',
  border: '1px solid #2a2418',
  borderRadius: 12,
};
const inputCss: React.CSSProperties = {
  background: '#1f1a14',
  border: '1px solid #3a3328',
  color: '#f4ede0',
  padding: '8px 10px',
  borderRadius: 6,
  fontFamily: 'IBM Plex Mono, monospace',
  fontSize: 12,
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
};
const labelSm: React.CSSProperties = {
  fontFamily: 'IBM Plex Mono, monospace',
  fontSize: 9.5,
  letterSpacing: '0.16em',
  color: '#8d8273',
  textTransform: 'uppercase',
  fontWeight: 600,
  marginBottom: 4,
  display: 'block',
};
const btnPrimary: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 8,
  fontFamily: 'Inter, sans-serif',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  border: 'none',
  background: '#c43a00',
  color: '#fff',
};
const btnGhost: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 8,
  fontFamily: 'Inter, sans-serif',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  background: 'transparent',
  color: '#f4ede0',
  border: '1px solid #3a3328',
};
const addBtn: React.CSSProperties = {
  ...btnGhost,
  marginTop: 10,
  fontSize: 12,
  padding: '8px 12px',
};
const addBtnSm: React.CSSProperties = {
  ...btnGhost,
  padding: '4px 8px',
  fontSize: 12,
};
const removeBtn: React.CSSProperties = {
  background: 'transparent',
  color: '#8d8273',
  border: '1px solid #3a3328',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 14,
  height: 28,
  padding: 0,
};
const loginWrap: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  background: '#14110b',
  color: '#f4ede0',
};
const loginCard: React.CSSProperties = {
  width: '100%',
  maxWidth: 360,
  padding: 32,
  background: '#0d0a06',
  border: '1px solid #2a2418',
  borderRadius: 12,
};
const loginTitle: React.CSSProperties = {
  fontFamily: 'Inter, sans-serif',
  fontSize: 20,
  fontWeight: 800,
  margin: 0,
  marginBottom: 4,
};
const loginSub: React.CSSProperties = {
  fontFamily: 'IBM Plex Mono, monospace',
  fontSize: 11,
  color: '#8d8273',
  marginTop: 0,
  marginBottom: 20,
  letterSpacing: '0.1em',
};
const loginInput: React.CSSProperties = {
  ...inputCss,
  padding: '12px 14px',
  fontSize: 14,
};
const errorBar: React.CSSProperties = {
  background: '#3a1410',
  color: '#fca5a5',
  fontFamily: 'IBM Plex Mono, monospace',
  fontSize: 11,
  letterSpacing: '0.08em',
  padding: '8px 28px',
  borderBottom: '1px solid #7f1d1d',
};
