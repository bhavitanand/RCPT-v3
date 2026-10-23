import type { Analysis, Explanation } from './types';
import { fmtAmount, fmtUsd } from './lib';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

async function sha256(text: string) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch { return 'unavailable in this browser'; }
}

// A self-contained, printable HTML evidence pack: findings, method, proof hashes, label provenance, integrity hash.
export async function buildEvidencePack(a: Analysis, ex: Explanation | null, myLabels: Record<string, string>, note: string) {
  const data = JSON.stringify({ meta: a.meta, verdict: a.verdict, stats: a.stats, flags: a.flags, transactions: a.transactions, counterparties: a.counterparties });
  const digest = await sha256(data);
  const txUrl = new Map(a.transactions.map(t => [t.hash, t.explorerUrl]));
  const live = a.meta.source === 'live';
  const hashLink = (h: string) => (txUrl.get(h) && live ? `<a href="${esc(txUrl.get(h))}">${esc(h)}</a>` : esc(h));
  const lab = (addr: string) => {
    const mine = myLabels[addr];
    const known = a.counterparties.find(c => c.address === addr)?.label;
    return [mine ? `<b>${esc(mine)}</b> (analyst label)` : '', known ? `${esc(known.name)} (${esc(known.categoryLabel)}; source: ${esc(known.source)})` : ''].filter(Boolean).join('<br>') || '<span class="m">none</span>';
  };

  const flags = a.flags.filter(f => f.score > 0 || f.type === 'exchange_exposure');
  const rows = (items: string[][]) => items.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>RCPT evidence pack - ${esc(a.meta.address)}</title>
<style>
body{font:14px/1.55 Inter,system-ui,sans-serif;color:#101731;max-width:900px;margin:32px auto;padding:0 20px}
h1{font-size:26px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
code,td.h{font-family:ui-monospace,Consolas,monospace;font-size:12px;word-break:break-all}
table{border-collapse:collapse;width:100%;font-size:12.5px}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f6f5ee}
.m{color:#6b7180}.box{background:#f6f5ee;border-radius:8px;padding:12px 14px}.warn{background:#fdf4e2;border-radius:8px;padding:10px 14px}
.score{font-size:34px;font-weight:800;color:${a.verdict.score >= 70 ? '#d93a45' : a.verdict.score >= 40 ? '#e0702b' : '#2e9e6b'}}
@media print{body{margin:0}a{color:inherit;text-decoration:none}}
</style></head><body>
<p class="m">RCPT v3 evidence pack · generated ${esc(new Date().toISOString())}</p>
<h1>${esc(a.verdict.label)}: ${esc(a.verdict.headline)}</h1>
${a.meta.source === 'demo' ? '<p class="warn"><b>SIMULATED DATA.</b> This pack was generated from a demonstration scenario, not a real wallet.</p>' : ''}
<p><span class="score">${a.verdict.score}</span><span class="m"> / 100 risk score</span></p>
<table><tr><th>Wallet</th><td class="h">${esc(a.meta.address)}</td></tr>
<tr><th>Network</th><td>${esc(a.meta.chainName)}</td></tr>
<tr><th>Data retrieved</th><td>${esc(new Date(a.meta.fetchedAt).toISOString())} (source: ${esc(a.meta.source)}; prices: ${esc(a.meta.priceSource)})</td></tr>
<tr><th>Activity</th><td>${a.stats.txCount} transactions, ${fmtUsd(a.stats.totalReceivedUsd)} received, ${fmtUsd(a.stats.totalSentUsd)} sent, ${a.stats.uniqueCounterparties} counterparties</td></tr>
${note ? `<tr><th>Analyst note</th><td>${esc(note)}</td></tr>` : ''}</table>
${ex ? `<h2>Summary</h2><div class="box"><p><b>${esc(ex.tldr)}</b></p>${ex.story.map(s => `<p><b>${esc(s.title)}.</b> ${esc(s.text)}</p>`).join('')}</div>` : ''}
<h2>Findings and proof</h2>
${flags.length ? flags.map(f => `<p><b>${esc(f.title)}</b> ${f.score ? `(+${f.score} points)` : '(lead)'} · wallet <code>${esc(f.wallet)}</code><br>${esc(f.plain)}<br>
<span class="m">Transactions:</span> ${f.evidence.length ? f.evidence.map(hashLink).map(h => `<code>${h}</code>`).join('<br>') : '<span class="m">derived from the address itself</span>'}</p>`).join('') : '<p>No warning signs were found.</p>'}
<h2>Counterparties and attribution</h2>
<table><tr><th>Wallet</th><th>Label and provenance</th><th>Sent to</th><th>Received from</th><th>Txs</th></tr>
${rows(a.counterparties.slice(0, 40).map(c => [`<code>${esc(c.address)}</code>`, lab(c.address), fmtUsd(c.sentUsd), fmtUsd(c.receivedUsd), String(c.txCount)]))}</table>
${a.linked ? `<h2>Wallets that probably share an owner</h2><p class="m">${esc(a.linked.basis)}</p><p>${a.linked.addresses.map(w => `<code>${esc(w)}</code>`).join('<br>')}</p>` : ''}
<h2>Transactions</h2>
<table><tr><th>Time (UTC)</th><th>Dir</th><th>Counterparty</th><th>Amount</th><th>USD</th><th>Hash</th></tr>
${rows(a.transactions.slice(0, 150).map(t => [esc(new Date(t.timestamp).toISOString().replace('T', ' ').slice(0, 16)), t.direction, `<code>${esc(t.direction === 'in' ? t.from : t.to)}</code>`, esc(fmtAmount(t.amount, t.symbol)), t.usd == null ? 'n/a' : fmtUsd(t.usd), `<code>${hashLink(t.hash)}</code>`]))}</table>
<h2>Method and limitations</h2>
<p>Risk scores come from fixed rules applied to public blockchain data. Each signal carries points; signals combine as 1 - Π(1 - points/100), so several weak signals add up while one strong signal dominates, capped at 100. Labels are public watchlist entries with the source shown above; they are context, not proof. Wallet linking by shared inputs is a heuristic. A score shows patterns that often appear in laundering and does not identify an owner or establish guilt.</p>
${a.meta.truncated ? '<p class="warn">Only the most recent transactions were analysed; older history is not reflected.</p>' : ''}
${a.meta.warnings.length ? `<p class="m">${a.meta.warnings.map(esc).join('<br>')}</p>` : ''}
<h2>Integrity</h2>
<p>SHA-256 of the underlying analysis data: <code>${digest}</code></p>
<p class="m">Generated by RCPT from read-only public blockchain data. Verify transaction hashes independently on a block explorer before relying on this document.</p>
</body></html>`;
}
