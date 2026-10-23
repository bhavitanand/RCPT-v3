import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, ScanSearch, Layers } from 'lucide-react';
import { api } from '../api';
import type { Extracted } from '../types';
import { go } from '../store';
import ExtractedPanel from './Extracted';
import { Spinner } from './ui';

const SHAPE = /^(0x[a-fA-F0-9]{40}|bc1[a-z0-9]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34}|T[1-9A-HJ-NP-Za-km-z]{33}|[1-9A-HJ-NP-Za-km-z]{32,44})$/;
const HASH = /^(0x[a-fA-F0-9]{64}|[a-fA-F0-9]{64}|[1-9A-HJ-NP-Za-km-z]{80,90})$/;

export default function SearchBox({ initial = '', big = false }: { initial?: string; big?: boolean }) {
  const [value, setValue] = useState(initial);
  const [chains, setChains] = useState<{ id: string; name: string }[]>([]);
  const [chain, setChain] = useState('auto');
  const [deep, setDeep] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<{ data: Extracted; single: boolean } | null>(null);

  const trimmed = value.trim();
  const looksValid = useMemo(() => SHAPE.test(trimmed), [trimmed]);
  const isHash = useMemo(() => HASH.test(trimmed), [trimmed]);
  const multiline = value.length > 110 || value.includes('\n');

  useEffect(() => {
    setChain('auto'); setFound(null);
    if (!looksValid) { setChains([]); return; }
    let live = true;
    const t = setTimeout(() => {
      api.detect(trimmed).then(r => { if (live) setChains(r.chains); }).catch(() => undefined);
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [trimmed, looksValid]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed) { setErr('Paste a wallet address, a transaction hash, or a ransom note.'); return; }
    setErr('');
    if (looksValid) { go('report', { address: trimmed, chain, ...(deep ? { depth: '2' } : {}) }); return; }
    // anything else: a transaction hash, or free text such as a ransom note
    setBusy(true);
    try {
      const data = await api.extract(trimmed);
      setFound({ data, single: isHash });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Could not read that text.');
    } finally { setBusy(false); }
  };

  return (
    <form className={`search ${big ? 'search-big' : ''}`} onSubmit={submit}>
      <div className="search-row">
        <ScanSearch size={big ? 22 : 18} className="search-ico" />
        {/* one element for every length, so typing never loses focus; it grows when the text is long */}
        <textarea
          value={value}
          rows={multiline ? 5 : 1}
          onChange={e => { setValue(e.target.value); setErr(''); }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
          placeholder="Paste a wallet, a transaction hash, or a whole ransom note"
          spellCheck={false}
          autoComplete="off"
          className={multiline ? '' : 'one-line'}
          aria-label="Wallet address, transaction hash or ransom note"
        />
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? <Spinner /> : <>{looksValid ? 'Trace' : isHash ? 'Look up' : 'Find'} <ArrowRight size={16} /></>}
        </button>
      </div>
      <div className="search-meta">
        {chains.length > 1 ? (
          <label className="chip-select">
            Network
            <select value={chain} onChange={e => setChain(e.target.value)}>
              <option value="auto">Auto (Ethereum)</option>
              {chains.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        ) : chains.length === 1 ? (
          <span className="detected">Detected: <strong>{chains[0].name}</strong></span>
        ) : (
          <span className="muted small">Ethereum · Bitcoin · Solana · Tron addresses. Got a ransom note or a payment receipt instead? Paste that.</span>
        )}
        <label className="toggle" title="Also look at the busiest wallets it dealt with, so multi-hop trails show up. Slower.">
          <input type="checkbox" checked={deep} onChange={e => setDeep(e.target.checked)} />
          <Layers size={14} /> Follow the trail deeper
        </label>
      </div>
      {err && <p className="form-err" role="alert">{err}</p>}
      {found && <ExtractedPanel data={found.data} autoOpenHash={found.single} />}
    </form>
  );
}
