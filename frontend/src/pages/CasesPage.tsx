import { useState } from 'react';
import { ArrowRight, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '../api';
import { go, useCases } from '../store';
import { ago, bandColor, shortAddr } from '../lib';
import { Pill, Spinner } from '../components/ui';

export default function CasesPage() {
  const { cases, remove, setNote, upsert } = useCases();
  const [busy, setBusy] = useState('');
  const [fails, setFails] = useState(0);

  // Re-check every live case one after another; scores and new-transaction counts update in place
  const recheckAll = async () => {
    setFails(0);
    let bad = 0;
    for (const c of cases.filter(x => !x.demo)) {
      setBusy(c.address);
      try {
        const a = await api.analyze({ address: c.address, chain: c.chain });
        upsert({ key: c.key, address: c.address, chain: c.chain, chainName: c.chainName, title: c.title, score: a.verdict.score, band: a.verdict.band, txCount: a.stats.txCount });
      } catch { bad++; }
    }
    setBusy(''); setFails(bad);
  };

  return (
    <main className="page narrow">
      <header className="page-head">
        <h1>Saved cases</h1>
        <p className="muted">Kept in this browser only. Re-check them to see whether a score moved or new transactions appeared.</p>
        {cases.some(c => !c.demo) && (
          <div className="row">
            <button className="btn btn-soft" onClick={recheckAll} disabled={!!busy}>{busy ? <><Spinner /> Checking {busy.slice(0, 8)}…</> : <><RefreshCw size={15} /> Re-check all</>}</button>
            {fails > 0 && <span className="form-err">{fails} could not be checked right now.</span>}
          </div>
        )}
      </header>
      {cases.length === 0 ? (
        <div className="card empty-state">
          <h2>Nothing saved yet</h2>
          <p className="muted">Run a trace and press "Save case" to keep an eye on a wallet.</p>
          <button className="btn btn-primary" onClick={() => go('home')}>Trace a wallet</button>
        </div>
      ) : (
        <ul className="case-list">
          {cases.map(c => (
            <li key={c.key} className="card case">
              <div className="case-score" style={{ borderColor: bandColor(c.band), color: bandColor(c.band) }}>
                {c.score}
                {c.prevScore !== undefined && <small>was {c.prevScore}</small>}
              </div>
              <div className="case-main">
                <strong>{c.title || shortAddr(c.address, 10, 8)}</strong>
                <span className="muted small">{c.chainName}{c.demo ? ' · simulated' : ` · ${shortAddr(c.address, 8, 6)}`} · checked {ago(c.checkedAt)}</span>
                <input className="note" placeholder="Add a private note…" value={c.note} onChange={e => setNote(c.key, e.target.value)} aria-label="Note" maxLength={200} />
              </div>
              <div className="case-actions">
                {c.demo && <Pill tone="caution">Sample</Pill>}
                {!!c.newTx && <Pill tone="orange">+{c.newTx} new tx</Pill>}
                <button className="btn btn-soft" onClick={() => go('report', c.demo ? { demo: c.demo } : { address: c.address, chain: c.chain })}>Re-check <ArrowRight size={14} /></button>
                <button className="icon-btn" onClick={() => remove(c.key)} aria-label="Delete case"><Trash2 size={15} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
