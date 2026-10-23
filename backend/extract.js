// extract.js — pull wallet addresses and transaction hashes out of free text (ransom notes, emails, chats)
const { detectChains, CHAINS } = require('./chains');

const TOKEN_RE = /[A-Za-z0-9]{25,100}/g;
const EVM_RE = /0x[a-fA-F0-9]{40,64}/g;

// Classify a bare string as a tx hash if it has a hash shape
function hashKind(s) {
  if (/^0x[a-fA-F0-9]{64}$/.test(s)) return 'evm';
  if (/^[a-fA-F0-9]{64}$/.test(s)) return 'hex64'; // Bitcoin or Tron
  if (/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(s)) return 'solana';
  return null;
}

function extract(text) {
  const src = String(text || '').slice(0, 20000);
  const seen = new Set();
  const addresses = [], hashes = [];
  const consider = tok => {
    if (seen.has(tok)) return;
    seen.add(tok);
    const hk = hashKind(tok);
    if (hk) { hashes.push({ hash: tok, kind: hk }); return; }
    const ids = detectChains(tok);
    if (ids.length) addresses.push({ address: tok, chains: ids.map(i => ({ id: i, name: CHAINS[i].name })) });
  };
  (src.match(EVM_RE) || []).forEach(consider);
  (src.match(TOKEN_RE) || []).forEach(consider);
  return { addresses: addresses.slice(0, 20), hashes: hashes.slice(0, 10) };
}

module.exports = { extract, hashKind };
