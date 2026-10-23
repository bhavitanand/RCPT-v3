// Solana via JSON-RPC (public endpoint by default; set SOLANA_RPC_URL for a faster one)
// Covers native SOL and SPL token transfers.
const { request } = require('./http');

const RPC = () => process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

// Mint -> symbol for tokens we can price as dollars. Unknown mints are still shown, just without a USD value.
const KNOWN_MINTS = { EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 'USDC' };

async function rpc(method, params) {
  const { data } = await request({ method: 'post', url: RPC(), data: { jsonrpc: '2.0', id: 1, method, params } });
  if (data.error) {
    const e = new Error(`Solana RPC: ${data.error.message}`);
    e.status = 502;
    throw e;
  }
  return data.result;
}

const keyOf = k => (typeof k === 'string' ? k : k.pubkey);

function pickTransfers(tx, sig, ts) {
  const out = [];
  const msg = tx.transaction && tx.transaction.message;
  if (!msg) return out;
  const keys = (msg.accountKeys || []).map(keyOf);

  // token account -> { owner, mint, decimals } from the balance snapshots
  const tokenAcct = new Map();
  [...((tx.meta && tx.meta.preTokenBalances) || []), ...((tx.meta && tx.meta.postTokenBalances) || [])].forEach(b => {
    const acct = keys[b.accountIndex];
    if (acct && b.owner) tokenAcct.set(acct, { owner: b.owner, mint: b.mint, decimals: b.uiTokenAmount && b.uiTokenAmount.decimals });
  });

  const visit = ix => {
    const p = ix.parsed;
    if (!p) return;
    if (ix.program === 'system' && p.type === 'transfer') {
      out.push({ hash: sig, from: p.info.source, to: p.info.destination, amount: Number(p.info.lamports) / 1e9, symbol: 'SOL', token: null, timestamp: ts });
    } else if (ix.program === 'spl-token' && (p.type === 'transfer' || p.type === 'transferChecked')) {
      const src = tokenAcct.get(p.info.source), dst = tokenAcct.get(p.info.destination);
      if (!src || !dst) return; // cannot tell who owns the accounts
      const mint = p.info.mint || src.mint;
      const decimals = p.type === 'transferChecked' ? p.info.tokenAmount.decimals : src.decimals;
      const amount = p.type === 'transferChecked' ? Number(p.info.tokenAmount.uiAmountString ?? p.info.tokenAmount.uiAmount) : Number(p.info.amount) / Math.pow(10, decimals || 0);
      const symbol = KNOWN_MINTS[mint] || `SPL-${String(mint).slice(0, 4)}`;
      if (src.owner !== dst.owner) out.push({ hash: sig, from: src.owner, to: dst.owner, amount, symbol, token: symbol, timestamp: ts });
    }
  };
  (msg.instructions || []).forEach(visit);
  ((tx.meta && tx.meta.innerInstructions) || []).forEach(g => (g.instructions || []).forEach(visit));
  return out;
}

async function mapLimit(items, n, fn) {
  const results = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; results[idx] = await fn(items[idx], idx).catch(() => null); }
  }));
  return results;
}

async function fetchAddress(chain, address, { limit = 30 } = {}) {
  const warnings = [];
  const [lamports, sigs, tokenAccts] = await Promise.all([
    rpc('getBalance', [address]).then(r => r.value / 1e9).catch(() => null),
    rpc('getSignaturesForAddress', [address, { limit }]),
    // Incoming token transfers only touch the wallet's token accounts, so look at those too
    rpc('getTokenAccountsByOwner', [address, { programId: TOKEN_PROGRAM }, { encoding: 'jsonParsed' }])
      .then(r => r.value.map(v => v.pubkey)).catch(() => []),
  ]);

  const extra = await mapLimit(tokenAccts.slice(0, 4), 2, a => rpc('getSignaturesForAddress', [a, { limit: 20 }]));
  const bySig = new Map();
  [...sigs, ...extra.filter(Boolean).flat()].forEach(s => { if (!s.err && !bySig.has(s.signature)) bySig.set(s.signature, s); });
  const ok = [...bySig.values()].sort((a, b) => (b.blockTime || 0) - (a.blockTime || 0)).slice(0, limit + 20);

  const parsed = await mapLimit(ok, 4, s =>
    rpc('getTransaction', [s.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }])
      .then(tx => (tx ? pickTransfers(tx, s.signature, (s.blockTime || tx.blockTime || Math.floor(Date.now() / 1000)) * 1000) : []))
  );
  const failed = parsed.filter(p => p === null).length;
  if (failed) warnings.push(`${failed} transaction(s) could not be read from the public Solana endpoint (rate limit). Results may be incomplete.`);

  // keep only payments that involve the searched wallet (token-account lookups also return unrelated transfers)
  const transactions = parsed.filter(Boolean).flat().filter(t => t.amount > 0 && (t.from === address || t.to === address));
  if (tokenAccts.length > 4) warnings.push('Only the first 4 token accounts of this wallet were examined.');
  warnings.push('Tokens other than USDC are shown but have no dollar value.');
  return { transactions, balance: lamports, truncated: sigs.length >= limit, warnings };
}

module.exports = { fetchAddress, pickTransfers };
