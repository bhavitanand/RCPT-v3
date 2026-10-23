import { useEffect, useState } from 'react';
import { CheckCircle2, CircleSlash } from 'lucide-react';
import { api } from '../api';
import type { Health } from '../types';

export default function StatusPage() {
  const [h, setH] = useState<Health | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.health().then(setH).catch(e => setErr(e instanceof Error ? e.message : 'Unreachable')); }, []);

  return (
    <main className="page narrow">
      <header className="page-head"><h1>System status</h1><p className="muted">What this server can do right now.</p></header>
      {err && <div className="card error-card"><h2>Server unreachable</h2><p>{err}</p></div>}
      {h && (
        <div className="stack">
          <section className="card section">
            <h2>Services</h2>
            <ul className="status-list">
              <li><CheckCircle2 size={18} className="ok" /> API <span className="muted">v{h.version}</span></li>
              <li>{h.gemini ? <CheckCircle2 size={18} className="ok" /> : <CircleSlash size={18} className="off" />} Gemini explanations
                <span className="muted">{h.gemini ? h.geminiModel : 'Off. The built-in explainer is used. Set GEMINI_API_KEY to enable.'}</span></li>
              <li>{h.ransomwhere.loaded ? <CheckCircle2 size={18} className="ok" /> : <CircleSlash size={18} className="off" />} Ransomwhere ransomware address list
                <span className="muted">{h.ransomwhere.loaded ? `${h.ransomwhere.loaded.toLocaleString('en-US')} Bitcoin addresses` : h.ransomwhere.error ? `Unavailable: ${h.ransomwhere.error}` : 'Loading or disabled (RANSOMWHERE=off)'}</span></li>
            </ul>
          </section>
          <section className="card section">
            <h2>Networks</h2>
            <ul className="status-list">
              {h.chains.map(c => (
                <li key={c.id}>{c.ready ? <CheckCircle2 size={18} className="ok" /> : <CircleSlash size={18} className="off" />} {c.name} <span className="muted">{c.symbol}{c.ready ? '' : ' · needs ETHERSCAN_API_KEY'}</span></li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </main>
  );
}
