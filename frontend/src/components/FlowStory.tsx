import { useEffect, useState } from 'react';
import { Play, Pause } from 'lucide-react';

// An animated, clickable walk-through of how a ransom payment is laundered.
const STEPS = [
  { title: 'A victim pays', text: 'After files are locked, the victim is told to send crypto to a wallet the criminals control. Each victim often gets a different address.' },
  { title: 'Payments are collected', text: 'The gang sweeps all those addresses into one collection wallet. Many wallets paying into one is a tell-tale shape (fan-in).' },
  { title: 'The pile is split up', text: 'The collection wallet divides the money among many new wallets so no single balance stands out (fan-out).' },
  { title: 'Hops and mixing', text: 'Funds are passed from wallet to wallet within minutes, or dropped into a mixer, to break the visible trail.' },
  { title: 'Cash-out', text: 'Eventually the money reaches an exchange to be swapped into normal currency. Exchanges know their customers, so this is where investigators can often catch up.' },
];

const POS = {
  victims: [[40, 40], [40, 100], [40, 160]],
  collect: [190, 100],
  split: [[330, 40], [330, 100], [330, 160]],
  hop: [[470, 40], [470, 100], [470, 160]],
  cash: [610, 100],
};

export default function FlowStory() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setStep(s => (s + 1) % STEPS.length), 3600);
    return () => clearInterval(t);
  }, [playing]);

  const on = (n: number) => step >= n;
  const line = (a: number[], b: number[], active: boolean, danger = false) => (
    <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className={`fs-line ${active ? 'on' : ''} ${danger ? 'danger' : ''}`} />
  );
  const dot = (p: number[], active: boolean, cls = '', r = 13) => (
    <circle cx={p[0]} cy={p[1]} r={r} className={`fs-node ${active ? 'on' : ''} ${cls}`} />
  );

  return (
    <div className="flowstory card">
      <div className="fs-stage">
        <svg viewBox="0 0 660 200" role="img" aria-label="Diagram of how ransom money moves from victims to an exchange">
          {POS.victims.map((v, i) => <g key={`v${i}`}>{line(v, POS.collect, on(0))}</g>)}
          {POS.split.map((s, i) => <g key={`s${i}`}>{line(POS.collect, s, on(2))}</g>)}
          {POS.split.map((s, i) => <g key={`h${i}`}>{line(s, POS.hop[i], on(3))}</g>)}
          {POS.hop.map((h, i) => <g key={`c${i}`}>{line(h, POS.cash, on(4), false)}</g>)}
          {POS.victims.map((v, i) => <g key={`vn${i}`}>{dot(v, on(0), 'victim')}</g>)}
          {dot(POS.collect, on(1), 'collector', 18)}
          {POS.split.map((s, i) => <g key={`sn${i}`}>{dot(s, on(2))}</g>)}
          {POS.hop.map((h, i) => <g key={`hn${i}`}>{dot(h, on(3), i === 1 ? 'mixer' : '')}</g>)}
          {dot(POS.cash, on(4), 'exchange', 18)}
          <text x="40" y="196" className="fs-cap" textAnchor="middle">Victims</text>
          <text x="190" y="136" className="fs-cap" textAnchor="middle">Collection</text>
          <text x="330" y="196" className="fs-cap" textAnchor="middle">Split</text>
          <text x="470" y="196" className="fs-cap" textAnchor="middle">Hops / mixer</text>
          <text x="610" y="136" className="fs-cap" textAnchor="middle">Exchange</text>
          {on(0) && <circle r="4" className="fs-coin"><animateMotion dur="3s" repeatCount="indefinite" path={`M40,100 L190,100 L330,100 L470,100 L610,100`} /></circle>}
        </svg>
      </div>
      <div className="fs-steps" role="tablist" aria-label="Steps">
        {STEPS.map((s, i) => (
          <button key={s.title} role="tab" aria-selected={i === step} className={`fs-step ${i === step ? 'active' : i < step ? 'past' : ''}`} onClick={() => { setStep(i); setPlaying(false); }}>
            <span className="fs-num">{i + 1}</span>
            {s.title}
          </button>
        ))}
        <button className="icon-btn" onClick={() => setPlaying(p => !p)} aria-label={playing ? 'Pause animation' : 'Play animation'}>
          {playing ? <Pause size={15} /> : <Play size={15} />}
        </button>
      </div>
      <p className="fs-text" aria-live="polite">{STEPS[step].text}</p>
    </div>
  );
}
