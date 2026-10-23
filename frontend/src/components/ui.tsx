import { useState, type ReactNode } from 'react';
import { Check, Copy, ExternalLink, Tag } from 'lucide-react';
import { GLOSSARY, copy, shortAddr, splitTerms } from '../lib';

export function Pill({ tone = 'neutral', children }: { tone?: string; children: ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

// Dotted-underline term with a hover/focus definition card
export function Term({ term, children }: { term: string; children: ReactNode }) {
  const def = GLOSSARY[term];
  if (!def) return <>{children}</>;
  return (
    <span className="term" tabIndex={0}>
      {children}
      <span className="term-card" role="tooltip">
        <strong>{term}</strong>
        {def}
      </span>
    </span>
  );
}

// Renders text and underlines the first mention of each glossary term
export function Rich({ text }: { text: string }) {
  return (
    <>
      {splitTerms(text).map((p, i) => (p.term ? <Term key={i} term={p.term}>{p.text}</Term> : <span key={i}>{p.text}</span>))}
    </>
  );
}

export function CopyBtn({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="icon-btn"
      title={label}
      aria-label={label}
      onClick={() => { copy(text); setDone(true); setTimeout(() => setDone(false), 1400); }}
    >
      {done ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

export function Addr({ address, url, full = false }: { address: string; url?: string; full?: boolean }) {
  return (
    <span className="addr">
      <code title={address}>{full ? address : shortAddr(address, 8, 6)}</code>
      <CopyBtn text={address} label="Copy address" />
      {url && (
        <a className="icon-btn" href={url} target="_blank" rel="noreferrer" title="Open in block explorer" aria-label="Open in block explorer">
          <ExternalLink size={14} />
        </a>
      )}
    </span>
  );
}

// Inline editor for your own private label on a wallet (stored in this browser only)
export function LabelEditor({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState(value);
  if (!edit) {
    return (
      <button className="link-btn" onClick={() => { setText(value); setEdit(true); }} title="Only you can see this label">
        {value ? <><Tag size={12} /> {value}</> : <><Tag size={12} /> Add my label</>}
      </button>
    );
  }
  return (
    <form className="label-edit" onSubmit={e => { e.preventDefault(); onSave(text); setEdit(false); }}>
      <input autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="e.g. Attacker wallet 1" maxLength={60} aria-label="Your label" />
      <button className="btn btn-soft" type="submit">Save</button>
    </form>
  );
}

export function Spinner() {
  return <span className="spinner" aria-label="Loading" />;
}

export function Section({ title, hint, children, right }: { title: string; hint?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="card section">
      <header className="section-head">
        <div>
          <h2>{title}</h2>
          {hint && <p className="muted">{hint}</p>}
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}
