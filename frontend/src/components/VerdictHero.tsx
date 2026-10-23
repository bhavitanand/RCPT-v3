import { useState } from 'react';
import { Bookmark, BookmarkCheck, Download, FileText, Link2, Network, Printer, TrendingDown, TrendingUp, Layers } from 'lucide-react';
import { go } from '../store';
import type { Analysis } from '../types';
import { bandColor, csvEscape, download, fmtDate, fmtUsd, copy } from '../lib';
import { Addr, Pill } from './ui';

function Gauge({ score, color }: { score: number; color: string }) {
  const r = 70, c = Math.PI * r; // half circle
  return (
    <svg className="gauge" viewBox="0 0 180 108" role="img" aria-label={`Risk score ${score} out of 100`}>
      <path d="M20 90 A70 70 0 0 1 160 90" className="gauge-track" />
      <path d="M20 90 A70 70 0 0 1 160 90" className="gauge-fill" style={{ stroke: color, strokeDasharray: c, strokeDashoffset: c - (score / 100) * c }} />
      <text x="90" y="82" textAnchor="middle" className="gauge-num" style={{ fill: color }}>{score}</text>
      <text x="90" y="102" textAnchor="middle" className="gauge-cap">out of 100</text>
    </svg>
  );
}

export default function VerdictHero({
  a, saved, onSave, onPack, onDeeper, onScan, scan,
}: {
  a: Analysis;
  saved: boolean;
  onSave: () => void;
  onPack: () => void;
  onDeeper?: () => void;
  onScan?: () => void;
  scan: { id: string; name: string; active: boolean | null; error?: string }[] | null;
}) {
  const color = bandColor(a.verdict.band);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 1600); };

  const exportCsv = () => {
    const head = ['time', 'direction', 'from', 'to', 'amount', 'asset', 'usd', 'hash'];
    const rows = a.transactions.map(t => [new Date(t.timestamp).toISOString(), t.direction, t.from, t.to, t.amount, t.symbol, t.usd ?? '', t.hash]);
    download(`rcpt-${a.meta.address.slice(0, 10)}.csv`, [head, ...rows].map(r => r.map(csvEscape).join(',')).join('\n'), 'text/csv');
  };

  const noun = a.meta.source === 'demo' ? 'Simulated sample' : a.meta.chainName;

  return (
    <section className="hero card" style={{ ['--tone' as string]: color }}>
      <div className="hero-left">
        <div className="hero-tags">
          <Pill tone={a.meta.source === 'demo' ? 'caution' : 'info'}>{noun}</Pill>
          {a.meta.source === 'demo' && <Pill tone="caution">Not a real wallet</Pill>}
          {a.meta.priceSource === 'approx' && a.meta.source === 'live' && <Pill tone="neutral">Approximate prices</Pill>}
        </div>
        <h1>{a.verdict.label}</h1>
        <p className="hero-sub">{a.verdict.headline}</p>
        <Addr address={a.meta.address} url={a.meta.source === 'live' ? a.meta.explorerUrl : undefined} full />
        <div className="hero-actions">
          <button className={`btn ${saved ? 'btn-ghost' : 'btn-primary'}`} onClick={() => { onSave(); flash(saved ? 'Case updated' : 'Saved to Cases'); }}>
            {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />} {saved ? 'Saved' : 'Save case'}
          </button>
          <button className="btn btn-ghost" onClick={() => { copy(window.location.href); flash('Link copied'); }}><Link2 size={16} /> Share link</button>
          <button className="btn btn-ghost" onClick={onPack} title="A self-contained report with proof hashes, label sources and an integrity hash"><FileText size={16} /> Evidence pack</button>
          <button className="btn btn-ghost" onClick={() => window.print()}><Printer size={16} /> Print / PDF</button>
          <button className="btn btn-ghost" onClick={exportCsv}><Download size={16} /> CSV</button>
          <button className="btn btn-ghost" onClick={() => download(`rcpt-${a.meta.address.slice(0, 10)}.json`, JSON.stringify(a, null, 2))}><Download size={16} /> JSON</button>
          {toast && <span className="toast" role="status">{toast}</span>}
        </div>
      </div>

      <div className="hero-gauge">
        <Gauge score={a.verdict.score} color={color} />
        <span className="muted small">Risk score, from {a.verdict.signals} kind{a.verdict.signals === 1 ? '' : 's'} of signal</span>
      </div>

      <dl className="hero-stats">
        <div><dt><TrendingDown size={14} /> Received</dt><dd>{fmtUsd(a.stats.totalReceivedUsd)}</dd></div>
        <div><dt><TrendingUp size={14} /> Sent</dt><dd>{fmtUsd(a.stats.totalSentUsd)}</dd></div>
        <div><dt>Transactions</dt><dd>{a.stats.txCount}</dd></div>
        <div><dt>Wallets dealt with</dt><dd>{a.stats.uniqueCounterparties}</dd></div>
        <div><dt>Active from</dt><dd className="sm">{fmtDate(a.stats.firstSeen)}</dd></div>
        <div><dt>Last active</dt><dd className="sm">{fmtDate(a.stats.lastSeen)}</dd></div>
      </dl>

      {(onDeeper || onScan || scan) && (
        <div className="hero-extra">
          {onDeeper && <button className="btn btn-soft" onClick={onDeeper}><Layers size={15} /> Follow the trail deeper</button>}
          {onScan && !scan && <button className="btn btn-soft" onClick={onScan}><Network size={15} /> Check other networks</button>}
          {scan && (
            <div className="scan">
              <span className="muted small">Activity of this address on other EVM networks:</span>
              {scan.map(n => (
                n.active ? (
                  <button key={n.id} className="pill pill-info pill-btn" onClick={() => go('report', { address: a.meta.address, chain: n.id })} title={`Trace this address on ${n.name}`}>
                    {n.name}: active, trace it
                  </button>
                ) : (
                  <Pill key={n.id} tone={n.active === false ? 'neutral' : 'caution'}>
                    {n.name}: {n.active === false ? 'none' : 'unavailable'}
                  </Pill>
                )
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
