import type { Band, Severity } from './types';

export const LANGUAGES = ['English', 'हिन्दी (Hindi)', 'Español', 'Français', 'Deutsch', 'Português', 'العربية', '中文', '日本語'];

export const STAGES = [
  { title: 'Recognising the network', detail: 'Working out which blockchain this address belongs to' },
  { title: 'Reading the blockchain', detail: 'Pulling every public transaction we can see' },
  { title: 'Pricing and tidying', detail: 'Converting amounts to dollars and removing noise' },
  { title: 'Checking watchlists', detail: 'Comparing wallets with known ransomware, mixer and sanctions lists' },
  { title: 'Hunting for laundering patterns', detail: 'Splitting, hopping, peel chains, bursts and more' },
  { title: 'Writing it up in plain English', detail: 'Turning the findings into something you can read' },
];

export const shortAddr = (a: string, head = 6, tail = 4) =>
  a.length > head + tail + 2 ? `${a.slice(0, head)}…${a.slice(-tail)}` : a;

export const fmtUsd = (n: number | null | undefined) => {
  if (n == null) return 'n/a';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `$${Math.round(n / 1000)}k`;
  if (n >= 1000) return `$${Math.round(n).toLocaleString('en-US')}`;
  return `$${n.toFixed(n < 1 && n > 0 ? 2 : 0)}`;
};

export const fmtAmount = (n: number, symbol: string) => {
  const digits = n >= 1000 ? 0 : n >= 1 ? 3 : 5;
  return `${n.toLocaleString('en-US', { maximumFractionDigits: digits })} ${symbol}`;
};

export const fmtDate = (ts: number | null) =>
  ts ? new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'n/a';

export const fmtDateTime = (ts: number) =>
  new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const ago = (ts: number) => {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};

export const bandColor = (b: Band) =>
  ({ high: 'var(--danger)', suspicious: 'var(--orange)', unusual: 'var(--caution)', ordinary: 'var(--safe)' })[b];

export const severityTone = (s: Severity | null) =>
  s === 'HIGH' ? 'danger' : s === 'MEDIUM' ? 'orange' : s === 'LOW' ? 'caution' : 'safe';

export const copy = (text: string) => navigator.clipboard?.writeText(text).catch(() => undefined);

export const download = (name: string, text: string, type = 'application/json') => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const csvEscape = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// ─── plain-language glossary used by hover tooltips ──────────────────────────
export const GLOSSARY: Record<string, string> = {
  wallet: 'An address on a blockchain that can hold and send money. Anyone can make one for free and it carries no name.',
  transaction: 'One transfer of money between two wallets, permanently written to a public ledger.',
  'transaction hash': 'The unique ID of a transaction. Think of it as a receipt number you can look up on a block explorer.',
  blockchain: 'A shared public ledger of every transaction. Anyone can read it, nobody can quietly edit it.',
  mixer: 'A service that pools money from many people and pays it out again so the original trail is harder to follow.',
  exchange: 'A company where people swap crypto for normal money. Exchanges usually know who their customers are.',
  'peel chain': 'A series of wallets where each hop passes most of the money on and shaves off a small slice.',
  laundering: 'Making illegally obtained money look legitimate by hiding where it came from.',
  ransomware: 'Malware that locks a victim’s files and demands payment, usually in crypto, to unlock them.',
  stablecoin: 'A crypto token designed to stay worth about one US dollar, such as USDT or USDC.',
  bridge: 'A service that moves value from one blockchain to another.',
  sanctioned: 'Listed by a government (for example the US OFAC) as someone it is illegal to deal with.',
  'fan-out': 'One wallet sending to many wallets, usually to divide up a large sum.',
  'fan-in': 'Many wallets sending into one, like victims paying one collection wallet.',
  dusting: 'Sending tiny amounts to many wallets, sometimes to track them or trick them into copying a fake address.',
};

const norm = (s: string) => s.toLowerCase().replace(/-/g, ' ');
const KEY_BY_NORM = new Map(Object.keys(GLOSSARY).map(k => [norm(k), k]));
const TERM_RE = new RegExp(
  `\\b(${[...KEY_BY_NORM.keys()].sort((a, b) => b.length - a.length).map(t => t.replace(/ /g, '[- ]')).join('|')})(s|es)?\\b`,
  'gi',
);

export function splitTerms(text: string): { text: string; term?: string }[] {
  const out: { text: string; term?: string }[] = [];
  let last = 0;
  const seen = new Set<string>();
  for (const m of text.matchAll(TERM_RE)) {
    const resolved = KEY_BY_NORM.get(norm(m[1]));
    if (!resolved || seen.has(resolved)) continue; // underline only the first mention
    seen.add(resolved);
    const idx = m.index ?? 0;
    if (idx > last) out.push({ text: text.slice(last, idx) });
    out.push({ text: m[0], term: resolved });
    last = idx + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
