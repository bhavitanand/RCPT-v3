import type { Analysis } from '../types';
import { fmtDate, fmtUsd } from '../lib';
import { useMyLabels } from '../store';
import { Addr, LabelEditor, Pill, Section } from './ui';

const BUCKETS: { key: keyof Analysis['outflow']; label: string; color: string; hint: string }[] = [
  { key: 'exchange', label: 'Exchanges', color: 'var(--info)', hint: 'Companies that know their customers. A strong lead for investigators.' },
  { key: 'mixer', label: 'Mixers', color: 'var(--mixer)', hint: 'Services that blur the trail.' },
  { key: 'flagged', label: 'Watchlisted', color: 'var(--danger)', hint: 'Known ransomware, scam, darknet or sanctioned addresses.' },
  { key: 'bridge', label: 'Bridges', color: 'var(--caution)', hint: 'Moves value to another blockchain.' },
  { key: 'unlabelled', label: 'Unlabelled wallets', color: '#bdbbad', hint: 'Wallets we have no information about.' },
];

export default function PeopleTab({ a }: { a: Analysis }) {
  const total = BUCKETS.reduce((s, b) => s + a.outflow[b.key], 0);
  const my = useMyLabels(a.meta.chain);
  return (
    <div className="stack">
      {a.linked && (
        <Section title="Wallets that probably share an owner" hint={a.linked.basis}>
          <ul className="linked-list">
            {a.linked.addresses.map(w => <li key={w}><Addr address={w} url={a.meta.source === 'live' ? a.meta.explorerUrl.replace(a.meta.address, w) : undefined} /></li>)}
          </ul>
          <p className="small muted">Found through {a.linked.transactions} shared transaction{a.linked.transactions === 1 ? '' : 's'}. Check these too: they may hold the rest of the money.</p>
        </Section>
      )}
      <Section title="Where the money ended up" hint="Based on every payment we could trace, grouped by what kind of place received it.">
        {total > 0 ? (
          <>
            <div className="stackbar" role="img" aria-label="Breakdown of where traced money went">
              {BUCKETS.filter(b => a.outflow[b.key] > 0).map(b => (
                <span key={b.key} style={{ width: `${(a.outflow[b.key] / total) * 100}%`, background: b.color }} title={`${b.label}: ${fmtUsd(a.outflow[b.key])}`} />
              ))}
            </div>
            <ul className="bucket-list">
              {BUCKETS.filter(b => a.outflow[b.key] > 0).map(b => (
                <li key={b.key}>
                  <i style={{ background: b.color }} />
                  <div><strong>{b.label}</strong> <span className="muted">{fmtUsd(a.outflow[b.key])} · {Math.round((a.outflow[b.key] / total) * 100)}%</span><p className="muted small">{b.hint}</p></div>
                </li>
              ))}
            </ul>
          </>
        ) : <p className="muted">No dollar-valued outgoing payments to break down. Token transfers without a known price are left out.</p>}
      </Section>

      <Section title="Wallets it dealt with" hint="Sorted by value. Labels come from public watchlists and are context, not proof.">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Wallet</th><th>What we know</th><th>My label</th><th className="num">Sent to</th><th className="num">Received from</th><th className="num">Payments</th><th>Last seen</th></tr></thead>
            <tbody>
              {a.counterparties.slice(0, 50).map(c => (
                <tr key={c.address}>
                  <td><Addr address={c.address} url={a.meta.source === 'live' ? c.explorerUrl : undefined} /></td>
                  <td>{c.label ? <Pill tone={c.label.tone === 'danger' ? 'danger' : c.label.tone === 'caution' ? 'caution' : 'info'}>{c.label.name}</Pill> : <span className="muted small">Unlabelled</span>}</td>
                  <td><LabelEditor value={my.get(c.address)} onSave={v => my.set(c.address, v)} /></td>
                  <td className="num">{fmtUsd(c.sentUsd)}</td>
                  <td className="num">{fmtUsd(c.receivedUsd)}</td>
                  <td className="num">{c.txCount}</td>
                  <td className="small">{fmtDate(c.lastTs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
