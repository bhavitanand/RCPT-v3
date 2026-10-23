import { useEffect, useState } from 'react';
import { ArrowRight, Eye, Languages, ShieldCheck, Sparkles, Waypoints } from 'lucide-react';
import { api } from '../api';
import type { DemoInfo, Health } from '../types';
import SearchBox from '../components/SearchBox';
import FlowStory from '../components/FlowStory';
import { go, useCases } from '../store';
import { Pill } from '../components/ui';
import { bandColor, ago } from '../lib';

const FEATURES = [
  { icon: Eye, title: 'See where it went', text: 'An interactive map of every hop, with a replay slider so you can watch the money move in order.' },
  { icon: Sparkles, title: 'Explained like a human would', text: 'Gemini turns the technical findings into a short story, what it means, and what to do next.' },
  { icon: Waypoints, title: 'Every major network', text: 'Ethereum and its sister chains, Bitcoin, Solana and Tron (home of USDT scams) in one place.' },
  { icon: ShieldCheck, title: 'Proof, not vibes', text: 'Every warning links to the exact transactions behind it, so you can verify or hand it to investigators.' },
  { icon: Languages, title: 'Built for non-experts', text: 'Hover any jargon for a definition. No account, no wallet connection, nothing to install.' },
];

export default function HomePage() {
  const [demos, setDemos] = useState<DemoInfo[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const { cases } = useCases();

  useEffect(() => {
    api.demos().then(setDemos).catch(() => undefined);
    api.health().then(setHealth).catch(() => undefined);
  }, []);

  return (
    <main className="page">
      <section className="landing">
        <Pill tone="brand">Ransomware Crypto Payment Tracker · v3</Pill>
        <h1>Follow the money,<br /><span className="mark">in plain English.</span></h1>
        <p className="lede">
          Paste any crypto wallet. RCPT shows where the money came from, where it went, and which parts look like laundering,
          then explains it so anyone can follow, not just blockchain experts.
        </p>
        <SearchBox big />
        {health && (
          <p className="chains-row" aria-label="Supported networks">
            {health.chains.map(c => <span key={c.id} className={c.ready ? '' : 'off'} title={c.ready ? '' : 'Needs an API key on the server'}>{c.name}</span>)}
          </p>
        )}
      </section>

      <section className="block">
        <header className="block-head">
          <h2>No address handy? Try a simulated investigation</h2>
          <p className="muted">These use generated sample data, so they work instantly with no keys.</p>
        </header>
        <div className="demo-grid">
          {demos.map(d => (
            <button key={d.id} className="card demo" onClick={() => go('report', { demo: d.id })}>
              <Pill tone="caution">Simulated · {d.chain}</Pill>
              <h3>{d.title}</h3>
              <p>{d.blurb}</p>
              <span className="go">Open investigation <ArrowRight size={15} /></span>
            </button>
          ))}
        </div>
      </section>

      {cases.length > 0 && (
        <section className="block">
          <header className="block-head"><h2>Your saved cases</h2></header>
          <div className="recent">
            {cases.slice(0, 4).map(c => (
              <button key={c.key} className="card recent-item" onClick={() => go('report', c.demo ? { demo: c.demo } : { address: c.address, chain: c.chain })}>
                <span className="dot" style={{ background: bandColor(c.band) }} />
                <div><strong>{c.title || c.address.slice(0, 14) + '…'}</strong><span className="muted small">{c.chainName} · checked {ago(c.checkedAt)}</span></div>
                <b style={{ color: bandColor(c.band) }}>{c.score}</b>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="block">
        <header className="block-head">
          <h2>How a ransom payment gets laundered</h2>
          <p className="muted">Tap a step. This is the story RCPT looks for in the data.</p>
        </header>
        <FlowStory />
      </section>

      <section className="block">
        <div className="feature-grid">
          {FEATURES.map(f => (
            <article key={f.title} className="feature">
              <f.icon size={22} />
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
