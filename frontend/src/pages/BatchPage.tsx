import { useState } from 'react';
import { ArrowRight, Download, ListChecks } from 'lucide-react';
import { api } from '../api';
import type { BatchRow } from '../types';
import { bandColor, csvEscape, download, fmtUsd, shortAddr } from '../lib';
import { go } from '../store';
import { Pill, Spinner } from '../components/ui';

const TOKEN = /[A-Za-z0-9]{25,64}/g;

export default function BatchPage() {
  const [text, setText] = useState('');
  const [rows, setRows] = useState<BatchRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = async () => {
    const list = [...new Set(text.match(TOKEN) ?? [])].slice(0, 10);
    if (!list.length) { setErr('Paste up to 10 wallet addresses, one per line or mixed into text.'); return; }
    setErr(''); setBusy(true); setRows(null);
    try { setRows(await api.batch(list)); } catch (e) { setErr(e instanceof Error ? e.message : 'Batch failed'); } finally { setBusy(false); }
  };

  const csv = () => {
    if (!rows) return;
    const head = ['address', 'network', 'score', 'verdict', 'transactions', 'received_usd', 'top_signals', 'error'];
    download('rcpt-batch.csv', [head, ...rows.map(r => [r.address, r.chainName, r.score, r.label, r.txCount, r.receivedUsd != null ? Math.round(r.receivedUsd) : '', (r.top ?? []).join('; '), r.error])].map(r => r.map(csvEscape).join(',')).join('\n'), 'text/csv');
  };

  return (
    <main className="page narrow">
      <header className="page-head">
        <h1>Batch check</h1>
        <p className="muted">Triage a list of wallets, for example the addresses from an incident report. Up to 10 at a time, any mix of networks, sorted riskiest first.</p>
      </header>
      <div className="card section">
        <textarea className="batch-input" rows={6} value={text} onChange={e => setText(e.target.value)} placeholder={'One address per line…\n0x…\nbc1…\nT…'} aria-label="Addresses" spellCheck={false} />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={run} disabled={busy}>{busy ? <><Spinner /> Checking…</> : <><ListChecks size={16} /> Check them</>}</button>
          {rows && <button className="btn btn-ghost" onClick={csv}><Download size={16} /> CSV</button>}
        </div>
        {err && <p className="form-err">{err}</p>}
        {busy && <p className="muted small">This takes a few seconds per wallet.</p>}
      </div>

      {rows && (
        <div className="card section" style={{ marginTop: 20 }}>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Wallet</th><th>Network</th><th className="num">Score</th><th>Top signals</th><th className="num">Received</th><th /></tr></thead>
              <tbody>
                {[...rows].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).map(r => (
                  <tr key={r.address}>
                    <td><code>{shortAddr(r.address, 8, 6)}</code></td>
                    <td>{r.chainName ?? '-'}</td>
                    {r.error ? <td colSpan={3}><span className="form-err">{r.error}</span></td> : <>
                      <td className="num"><b style={{ color: bandColor(r.band!) }}>{r.score}</b></td>
                      <td>{r.top?.length ? r.top.map(t => <Pill key={t} tone="orange">{t}</Pill>) : <span className="muted small">{r.label}</span>}</td>
                      <td className="num">{fmtUsd(r.receivedUsd)}</td>
                    </>}
                    <td>{!r.error && <button className="icon-btn" onClick={() => go('report', { address: r.address, chain: r.chain! })} aria-label="Open full report"><ArrowRight size={15} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
