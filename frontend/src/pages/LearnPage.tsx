import { ExternalLink } from 'lucide-react';
import FlowStory from '../components/FlowStory';
import { GLOSSARY } from '../lib';

const PATTERNS = [
  { title: 'Fan-in (consolidation)', text: 'Many wallets pay into one within hours. Ransomware gangs hand each victim a fresh address, then sweep them together.', svg: 'fanin' },
  { title: 'Fan-out (splitting)', text: 'One wallet suddenly pays many others. Dividing a pile makes each slice look small and unimportant.', svg: 'fanout' },
  { title: 'Rapid hopping', text: 'Money that arrives and leaves within minutes, wallet after wallet. Real users rarely do this.', svg: 'hop' },
  { title: 'Peel chain', text: 'Each hop forwards most of the balance and peels a small slice sideways. Moves big sums while blending in.', svg: 'peel' },
  { title: 'Mixer / sanctioned contact', text: 'Direct dealings with a mixer or a sanctioned address. The strongest single warning sign we check.', svg: 'mixer' },
  { title: 'Sleeping wallet wakes up', text: 'Months of silence, then a burst of activity. Often stored proceeds being cashed out.', svg: 'sleep' },
];

function Mini({ kind }: { kind: string }) {
  const n = (x: number, y: number, r = 6, c = '') => <circle key={`${x}${y}`} cx={x} cy={y} r={r} className={`mini-n ${c}`} />;
  const l = (x1: number, y1: number, x2: number, y2: number) => <line key={`${x1}${y1}${x2}${y2}`} x1={x1} y1={y1} x2={x2} y2={y2} className="mini-l" />;
  return (
    <svg viewBox="0 0 120 60" className="mini" aria-hidden="true">
      {kind === 'fanin' && <>{[10, 30, 50].map(y => l(15, y, 100, 30))}{[10, 30, 50].map(y => n(15, y))}{n(100, 30, 8, 'hot')}</>}
      {kind === 'fanout' && <>{[10, 30, 50].map(y => l(20, 30, 105, y))}{[10, 30, 50].map(y => n(105, y))}{n(20, 30, 8, 'hot')}</>}
      {kind === 'hop' && <>{[15, 45, 75, 105].map((x, i) => i < 3 && l(x, 30, x + 30, 30))}{[15, 45, 75, 105].map(x => n(x, 30))}</>}
      {kind === 'peel' && <>{l(12, 30, 42, 30)}{l(42, 30, 72, 30)}{l(72, 30, 102, 30)}{l(42, 30, 42, 52)}{l(72, 30, 72, 52)}{[12, 42, 72, 102].map(x => n(x, 30))}{n(42, 52, 4)}{n(72, 52, 4)}</>}
      {kind === 'mixer' && <>{l(15, 15, 60, 30)}{l(15, 45, 60, 30)}{l(60, 30, 105, 15)}{l(60, 30, 105, 45)}{n(15, 15)}{n(15, 45)}{n(105, 15)}{n(105, 45)}{n(60, 30, 11, 'hot')}</>}
      {kind === 'sleep' && <>{l(10, 40, 50, 40)}{[8, 14, 20].map(d => l(88 + d - 8, 40, 88 + d - 8, 14 + d))}{n(10, 40, 4)}{n(95, 24, 5, 'hot')}{n(101, 20, 5, 'hot')}{n(107, 16, 5, 'hot')}</>}
    </svg>
  );
}

const FAQ = [
  ['Is crypto anonymous?', 'Not really. It is pseudonymous: wallets have no names, but every transaction is public forever. The hard part is linking a wallet to a real person, which usually happens at an exchange.'],
  ['Does a high score mean someone is guilty?', 'No. The score counts patterns that often show up in laundering. Businesses, traders and even victims can trigger some of them. Treat it as a reason to look closer, not a verdict.'],
  ['Can you tell me who owns a wallet?', 'No, and we will not guess. We can show where money went and whether it touched known exchanges, mixers or watchlisted addresses. Naming an owner takes legal process through an exchange.'],
  ['Can stolen or ransom money be recovered?', 'Sometimes. Funds that reach an exchange can be frozen if law enforcement acts quickly. Speed and a clear trail of transaction hashes make the difference.'],
  ['Someone offered to recover my crypto for a fee. Is that real?', 'Almost certainly not. "Recovery agents" who contact you first, or ask for an upfront fee, are a well-known second scam aimed at victims. Real recovery only comes through police and the exchanges where the money landed. Never share seed phrases or give remote access to your devices.'],
  ['What if the trail goes to another blockchain?', 'Money can cross chains through bridges or swap services, and many tools lose it there. Use "Check other networks" on an EVM address, then trace the same address on each network. Beware that the same token ticker on two chains is not the same asset.'],
  ['I only have a transaction receipt or a ransom note. Can I still start?', 'Yes. Paste the whole note or the transaction hash on the home page. RCPT finds wallet addresses inside the text, or shows who paid whom in the transaction so you can pick a wallet to follow.'],
  ['Why do I only see some transactions?', 'To stay fast we read the most recent activity. Reports say when history was cut short.'],
];

const HELP = [
  { name: 'No More Ransom', url: 'https://www.nomoreransom.org', note: 'Free decryptors and advice, backed by Europol and security vendors.' },
  { name: 'cybercrime.gov.in', url: 'https://cybercrime.gov.in', note: 'Report cyber fraud and ransomware in India (helpline 1930 for financial fraud).' },
  { name: 'IC3 (FBI)', url: 'https://www.ic3.gov', note: 'Report in the United States.' },
  { name: 'Europol / local police', url: 'https://www.europol.europa.eu/report-a-crime', note: 'Find where to report in Europe.' },
];

export default function LearnPage() {
  return (
    <main className="page narrow learn">
      <header className="page-head">
        <h1>How this works, in plain words</h1>
        <p className="muted">No background needed. Start at the top.</p>
      </header>

      <section className="block"><h2>The journey of a ransom payment</h2><FlowStory /></section>

      <section className="block">
        <h2>The patterns we look for</h2>
        <div className="pattern-grid">
          {PATTERNS.map(p => (
            <article key={p.title} className="card pattern">
              <Mini kind={p.svg} />
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="block">
        <h2>Common questions</h2>
        <div className="faq">
          {FAQ.map(([q, a]) => <details key={q} className="card"><summary>{q}</summary><p>{a}</p></details>)}
        </div>
      </section>

      <section className="block">
        <h2>If you've been hit by ransomware</h2>
        <ol className="checklist card">
          <li><strong>Disconnect</strong> affected devices from the network, but do not wipe them.</li>
          <li><strong>Do not pay</strong> before talking to professionals. Payment funds the next attack and does not guarantee your files back.</li>
          <li><strong>Save evidence</strong>: the ransom note, the wallet address, and any transaction hashes. Paste the address here for a trace.</li>
          <li><strong>Report it</strong> quickly. Speed matters if the money is still moving.</li>
        </ol>
        <ul className="help-links">
          {HELP.map(h => (
            <li key={h.name}><a href={h.url} target="_blank" rel="noreferrer">{h.name} <ExternalLink size={13} /></a><span className="muted small">{h.note}</span></li>
          ))}
        </ul>
      </section>

      <section className="block">
        <h2>Glossary</h2>
        <dl className="glossary card">
          {Object.entries(GLOSSARY).map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}
        </dl>
      </section>
    </main>
  );
}
