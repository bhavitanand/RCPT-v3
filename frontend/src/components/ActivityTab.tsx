import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ExternalLink, Flag as FlagIcon } from 'lucide-react';
import type { Analysis } from '../types';
import { fmtAmount, fmtDateTime, fmtUsd, shortAddr } from '../lib';
import { CopyBtn } from './ui';

function DailyChart({ a }: { a: Analysis }) {
  const days = useMemo(() => {
    const m = new Map<string, { inn: number; out: number; ts: number }>();
    a.transactions.forEach(t => {
      const d = new Date(t.timestamp); d.setHours(0, 0, 0, 0);
      const k = String(d.getTime());
      const cur = m.get(k) ?? { inn: 0, out: 0, ts: d.getTime() };
      const v = t.usd ?? 1; // fall back to counting when there is no dollar value
      if (t.direction === 'in') cur.inn += v; else cur.out += v;
      m.set(k, cur);
    });
    return [...m.values()].sort((x, y) => x.ts - y.ts);
  }, [a]);
  const max = Math.max(...days.map(d => Math.max(d.inn, d.out)), 1);
  const W = 640, H = 150, pad = 8;
  const bw = Math.max(4, Math.min(28, (W - pad * 2) / Math.max(days.length, 1) - 6));
  const step = (W - pad * 2) / Math.max(days.length, 1);
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H + 22}`} role="img" aria-label="Money in and out per day">
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="axis" />
        {days.map((d, i) => {
          const x = pad + i * step + step / 2 - bw / 2;
          const hi = (d.inn / max) * (H / 2 - 6), ho = (d.out / max) * (H / 2 - 6);
          return (
            <g key={d.ts}>
              <rect x={x} y={H / 2 - hi} width={bw} height={hi} rx="2" className="bar-in"><title>{`In ${fmtUsd(d.inn)} on ${new Date(d.ts).toDateString()}`}</title></rect>
              <rect x={x} y={H / 2} width={bw} height={ho} rx="2" className="bar-out"><title>{`Out ${fmtUsd(d.out)} on ${new Date(d.ts).toDateString()}`}</title></rect>
              {(i === 0 || i === days.length - 1 || days.length < 9) && (
                <text x={x + bw / 2} y={H + 16} textAnchor="middle" className="axis-label">{new Date(d.ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption><span><i className="dot in" />Money in</span><span><i className="dot out" />Money out</span></figcaption>
    </figure>
  );
}

export default function ActivityTab({ a }: { a: Analysis }) {
  const [filter, setFilter] = useState<'all' | 'in' | 'out' | 'flagged'>('all');
  const flaggedHashes = useMemo(() => {
    const s = new Map<string, string>();
    a.flags.filter(f => f.score > 0).forEach(f => f.evidence.forEach(h => { if (!s.has(h)) s.set(h, f.title); }));
    return s;
  }, [a]);
  const rows = a.transactions.filter(t => filter === 'all' || (filter === 'flagged' ? flaggedHashes.has(t.hash) : t.direction === filter));

  return (
    <div className="stack">
      <section className="card section">
        <header className="section-head"><div><h2>Money in and out, day by day</h2><p className="muted">Bars show dollar value where known.</p></div></header>
        <DailyChart a={a} />
      </section>

      <section className="card section">
        <header className="section-head">
          <div><h2>Every transaction</h2><p className="muted">{a.transactions.length} involving this wallet{a.meta.truncated ? ' (most recent only)' : ''}.</p></div>
          <div className="seg">
            {(['all', 'in', 'out', 'flagged'] as const).map(f => (
              <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : f === 'in' ? 'In' : f === 'out' ? 'Out' : 'Flagged'}</button>
            ))}
          </div>
        </header>
        <ul className="tx-list">
          {rows.slice(0, 200).map((t, i) => {
            const why = flaggedHashes.get(t.hash);
            const other = t.direction === 'in' ? t.from : t.to;
            return (
              <li key={`${t.hash}-${i}`} className={`tx ${why ? 'flagged' : ''}`}>
                <span className={`tx-dir ${t.direction}`}>{t.direction === 'in' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span>
                <div className="tx-main">
                  <strong>{t.direction === 'in' ? 'Received' : 'Sent'} {fmtAmount(t.amount, t.symbol)}{t.usd != null && <span className="muted"> · {fmtUsd(t.usd)}</span>}</strong>
                  <span className="muted small">{t.direction === 'in' ? 'from' : 'to'} <code>{shortAddr(other, 8, 6)}</code> · {fmtDateTime(t.timestamp)}</span>
                </div>
                {why && <span className="pill pill-orange" title="This transaction is part of the evidence for a flagged pattern"><FlagIcon size={11} /> {why}</span>}
                <span className="tx-actions">
                  <CopyBtn text={t.hash} label="Copy transaction hash" />
                  {a.meta.source === 'live' && <a className="icon-btn" href={t.explorerUrl} target="_blank" rel="noreferrer" aria-label="Open transaction in explorer"><ExternalLink size={14} /></a>}
                </span>
              </li>
            );
          })}
          {rows.length === 0 && <li className="empty">Nothing matches this filter.</li>}
        </ul>
        {rows.length > 200 && <p className="muted small">Showing the latest 200. Export CSV for everything.</p>}
      </section>
    </div>
  );
}
