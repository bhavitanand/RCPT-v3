import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Analysis, Flag } from '../types';
import { shortAddr, severityTone } from '../lib';
import { Addr, CopyBtn, Pill, Rich, Section } from './ui';

function FlagCard({ f, a }: { f: Flag; a: Analysis }) {
  const [open, setOpen] = useState(false);
  const info = a.patterns[f.type];
  return (
    <li className={`flag flag-${f.score === 0 ? 'info' : severityTone(f.score >= 35 ? 'HIGH' : f.score >= 20 ? 'MEDIUM' : 'LOW')}`}>
      <div className="flag-top">
        <strong>{f.title}</strong>
        <Pill tone={f.score === 0 ? 'info' : 'neutral'}>{f.score === 0 ? 'lead' : `+${f.score} pts`}</Pill>
      </div>
      <p><Rich text={f.plain} /></p>
      {f.path && f.path.length > 1 && (
        <p className="path small muted">Route: {f.path.map(p => shortAddr(p, 5, 4)).join(' → ')}</p>
      )}
      <button className="link-btn" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <ChevronDown size={14} className={open ? 'flip' : ''} /> {open ? 'Hide' : 'Show'} proof and why it matters
      </button>
      {open && (
        <div className="flag-more">
          {info && <p className="small"><strong>Why this matters:</strong> {info.why}</p>}
          <p className="small"><strong>Transactions behind it</strong> ({f.evidence.length}):</p>
          <ul className="hash-list">
            {f.evidence.map(h => <li key={h}><code>{shortAddr(h, 10, 8)}</code><CopyBtn text={h} label="Copy transaction hash" /></li>)}
            {f.evidence.length === 0 && <li className="muted small">This signal comes from the address itself, not a specific transaction.</li>}
          </ul>
        </div>
      )}
    </li>
  );
}

export default function EvidenceTab({ a }: { a: Analysis }) {
  const target = a.meta.address;
  const wallets = [...new Set(a.flags.map(f => f.wallet))];
  const ordered = [target, ...wallets.filter(w => w !== target)].filter(w => wallets.includes(w));
  const tFlags = a.flags.filter(f => f.wallet === target && f.score > 0);

  return (
    <div className="stack">
      <Section title="How the score was built" hint="Each warning sign is worth some points. They are combined so that several weak signs add up, but one strong sign (like a watchlist hit) counts for more. The total never passes 100.">
        {tFlags.length ? (
          <ul className="score-bars">
            {tFlags.map((f, i) => (
              <li key={i}>
                <span>{f.title}</span>
                <div className="bar"><i style={{ width: `${Math.min(100, f.score)}%` }} /></div>
                <b>+{f.score}</b>
              </li>
            ))}
            <li className="total"><span>Combined score for this wallet</span><div className="bar"><i style={{ width: `${a.verdict.score}%` }} /></div><b>{a.verdict.score}</b></li>
          </ul>
        ) : <p className="muted">No warning signs were found for the investigated wallet, so its score is {a.verdict.score}.</p>}
        <p className="small muted">Scores come from fixed, published rules. They show patterns, not guilt, and cannot see off-chain context such as who actually owns a wallet.</p>
      </Section>

      {ordered.length === 0 && <p className="muted card section">Nothing to show: no patterns matched.</p>}
      {ordered.map(w => {
        const fl = a.flags.filter(f => f.wallet === w);
        const p = a.profiles.find(x => x.wallet === w);
        return (
          <Section
            key={w}
            title={w === target ? 'The investigated wallet' : 'Another wallet in the trail'}
            right={p && <Pill tone={severityTone(p.severity)}>{p.riskScore} · {p.severity.toLowerCase()}</Pill>}
          >
            <Addr address={w} url={a.meta.source === 'live' ? a.meta.explorerUrl.replace(target, w) : undefined} />
            <ul className="flags">{fl.map((f, i) => <FlagCard key={i} f={f} a={a} />)}</ul>
          </Section>
        );
      })}
    </div>
  );
}
