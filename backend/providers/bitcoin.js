// Bitcoin via the public mempool.space API (no key needed)
//
// Bitcoin is UTXO-based: one transaction has many inputs and outputs. We flatten it into
// directed "payments" relative to the investigated address:
//   - address is an input  → it paid every other output (amount = that output's value)
//   - address is only an output → every input address paid it (value split by input share)
const { request } = require('./http');

const BASE = process.env.BTC_API_BASE || 'https://mempool.space/api';

async function fetchAddress(chain, address, { limit = 50 } = {}) {
  const [info, firstPage] = await Promise.all([
    request({ url: `${BASE}/address/${address}` }).then(r => r.data),
    request({ url: `${BASE}/address/${address}/txs` }).then(r => r.data),
  ]);

  let raw = firstPage.slice();
  let truncated = false;
  // mempool.space returns 25 confirmed txs per page; keep paging until we hit the limit
  while (raw.length < limit) {
    const confirmed = raw.filter(t => t.status && t.status.confirmed);
    if (confirmed.length === 0 || confirmed.length < 25) break;
    const last = confirmed[confirmed.length - 1].txid;
    const next = await request({ url: `${BASE}/address/${address}/txs/chain/${last}` }).then(r => r.data).catch(() => []);
    if (!next.length) break;
    raw = raw.concat(next);
  }
  if (raw.length > limit) { raw = raw.slice(0, limit); truncated = true; }
  if (info.chain_stats && info.chain_stats.tx_count > raw.length) truncated = true;

  const transactions = [];
  const coSpend = [];
  raw.forEach(tx => {
    const ts = (tx.status && tx.status.block_time ? tx.status.block_time : Math.floor(Date.now() / 1000)) * 1000;
    const ins = (tx.vin || []).filter(v => v.prevout && v.prevout.scriptpubkey_address);
    const outs = (tx.vout || []).filter(v => v.scriptpubkey_address);
    const isSender = ins.some(v => v.prevout.scriptpubkey_address === address);

    // Common-input-ownership heuristic: wallets that sign one transaction together usually share an owner.
    // CoinJoin-style transactions (many equal-sized outputs) are deliberately excluded because they break it.
    const inputAddrs = [...new Set(ins.map(v => v.prevout.scriptpubkey_address))];
    const counts = {}; outs.forEach(o => { counts[o.value] = (counts[o.value] || 0) + 1; });
    const coinjoinLike = outs.length >= 5 && Math.max(0, ...Object.values(counts)) >= 3;
    if (inputAddrs.length >= 2 && !coinjoinLike) coSpend.push(inputAddrs);

    if (isSender) {
      outs.forEach(o => {
        if (o.scriptpubkey_address === address) return; // change back to self
        transactions.push({ hash: tx.txid, from: address, to: o.scriptpubkey_address, amount: o.value / 1e8, symbol: 'BTC', token: null, timestamp: ts });
      });
    } else {
      const mine = outs.filter(o => o.scriptpubkey_address === address).reduce((s, o) => s + o.value, 0);
      const totalIn = ins.reduce((s, v) => s + v.prevout.value, 0);
      if (!mine || !totalIn) return; // e.g. coinbase
      const bySender = {};
      ins.forEach(v => { bySender[v.prevout.scriptpubkey_address] = (bySender[v.prevout.scriptpubkey_address] || 0) + v.prevout.value; });
      Object.entries(bySender).forEach(([sender, val]) => {
        transactions.push({ hash: tx.txid, from: sender, to: address, amount: (mine * (val / totalIn)) / 1e8, symbol: 'BTC', token: null, timestamp: ts });
      });
    }
  });

  const cs = info.chain_stats || {};
  const ms = info.mempool_stats || {};
  const balance = (cs.funded_txo_sum - cs.spent_txo_sum + (ms.funded_txo_sum || 0) - (ms.spent_txo_sum || 0)) / 1e8;
  return { transactions, balance, truncated, warnings: [], coSpend };
}

module.exports = { fetchAddress };
