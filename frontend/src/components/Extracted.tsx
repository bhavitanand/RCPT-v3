import { useEffect, useState } from 'react';
import { ArrowRight, FileSearch, Hash } from 'lucide-react';
import { api } from '../api';
import type { Extracted, TxLookup } from '../types';
import { fmtAmount, fmtDateTime, shortAddr } from '../lib';
import { go } from '../store';
import { Pill, Spinner } from './ui';

const cleanAddr = (a: string) => a.replace(/ \(\+\d+ more\)$/, '');

function HashCard({ hash, autoOpen }: { hash: string; autoOpen?: boolean }) {
  const [state, setState] = useState<{ s: 'idle' | 'loading' } | { s: 'err'; m: string } | { s: 'ok'; d: TxLookup }>({ s: 'idle' });
  const open = () => {
    setState({ s: 'loading' });
    api.tx(hash).then(d => setState({ s: 'ok', d })).catch(e => setState({ s: 'err', m: e instanceof Error ? e.message : 'Lookup failed' }));
  };
  useEffect(() => { if (autoOpen) open(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <li className="ex-item">
      <div className="ex-head">
        <Hash size={15} /> <code>{shortAddr(hash, 10, 8)}</code>
        <Pill tone="neutral">transaction</Pill>
        {state.s === 'idle' && <button className="btn btn-soft" onClick={open}>Look it up</button>}
        {state.s === 'loading' && <span className="muted small"><Spinner /> Searching networks…</span>}
      </div>
      {state.s === 'err' && <p className="form-err">{state.m}</p>}
      {state.s === 'ok' && (
        <div className="ex-tx">
          <p className="small muted">{state.d.networkName}{state.d.time ? ` · ${fmtDateTime(state.d.time)}` : ''} · pick the wallet you want to follow:</p>
          {state.d.transfers.length === 0 && <p className="muted small">No simple transfers found in this transaction.</p>}
          {state.d.transfers.map((t, i) => (
            <div key={i} className="ex-transfer">
              <button className="btn btn-ghost" onClick={() => go('report', { address: cleanAddr(t.from), chain: state.d.network })}><code>{shortAddr(cleanAddr(t.from), 6, 4)}</code> sender</button>
              <ArrowRight size={14} />
              <strong>{fmtAmount(t.amount, t.symbol)}</strong>
              <ArrowRight size={14} />
              <button className="btn btn-ghost" onClick={() => go('report', { address: t.to, chain: state.d.network })}><code>{shortAddr(t.to, 6, 4)}</code> receiver</button>
            </div>
          ))}
          {state.d.note && <p className="small muted">{state.d.note}</p>}
        </div>
      )}
    </li>
  );
}

export default function ExtractedPanel({ data, autoOpenHash }: { data: Extracted; autoOpenHash?: boolean }) {
  const none = data.addresses.length === 0 && data.hashes.length === 0;
  return (
    <div className="card extracted" role="region" aria-label="Items found in your text">
      <h3><FileSearch size={17} /> {none ? 'Nothing recognisable found' : `Found ${data.addresses.length + data.hashes.length} item${data.addresses.length + data.hashes.length === 1 ? '' : 's'}`}</h3>
      {none && <p className="muted small">We look for wallet addresses and transaction hashes. Check for typos, or paste the address on its own.</p>}
      <ul>
        {data.addresses.map(a => (
          <li key={a.address} className="ex-item">
            <div className="ex-head">
              <code>{shortAddr(a.address, 10, 8)}</code>
              {a.chains.length === 1 ? <Pill tone="info">{a.chains[0].name}</Pill> : <Pill tone="info">EVM networks</Pill>}
              <button className="btn btn-primary" onClick={() => go('report', { address: a.address, chain: a.chains[0].id })}>Trace <ArrowRight size={14} /></button>
            </div>
          </li>
        ))}
        {data.hashes.map(h => <HashCard key={h.hash} hash={h.hash} autoOpen={autoOpenHash} />)}
      </ul>
    </div>
  );
}
