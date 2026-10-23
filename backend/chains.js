// chains.js — registry of supported networks + address detection

const b58 = require('./lib/base58');

const CHAINS = {
  ethereum: { id: 'ethereum', name: 'Ethereum',  symbol: 'ETH',  family: 'evm',     evmChainId: 1,     explorer: 'https://etherscan.io',               cgId: 'ethereum',    fallbackUsd: 3000 },
  bsc:      { id: 'bsc',      name: 'BNB Chain', symbol: 'BNB',  family: 'evm',     evmChainId: 56,    explorer: 'https://bscscan.com',                cgId: 'binancecoin', fallbackUsd: 600 },
  polygon:  { id: 'polygon',  name: 'Polygon',   symbol: 'POL',  family: 'evm',     evmChainId: 137,   explorer: 'https://polygonscan.com',            cgId: 'polygon-ecosystem-token', fallbackUsd: 0.4 },
  arbitrum: { id: 'arbitrum', name: 'Arbitrum',  symbol: 'ETH',  family: 'evm',     evmChainId: 42161, explorer: 'https://arbiscan.io',                cgId: 'ethereum',    fallbackUsd: 3000 },
  optimism: { id: 'optimism', name: 'Optimism',  symbol: 'ETH',  family: 'evm',     evmChainId: 10,    explorer: 'https://optimistic.etherscan.io',    cgId: 'ethereum',    fallbackUsd: 3000 },
  base:     { id: 'base',     name: 'Base',      symbol: 'ETH',  family: 'evm',     evmChainId: 8453,  explorer: 'https://basescan.org',               cgId: 'ethereum',    fallbackUsd: 3000 },
  bitcoin:  { id: 'bitcoin',  name: 'Bitcoin',   symbol: 'BTC',  family: 'utxo',    explorer: 'https://mempool.space',                              cgId: 'bitcoin',     fallbackUsd: 70000 },
  solana:   { id: 'solana',   name: 'Solana',    symbol: 'SOL',  family: 'solana',  explorer: 'https://solscan.io',                                 cgId: 'solana',      fallbackUsd: 150 },
  tron:     { id: 'tron',     name: 'Tron',      symbol: 'TRX',  family: 'tron',    explorer: 'https://tronscan.org',                               cgId: 'tron',        fallbackUsd: 0.15 },
};

const EVM_RE  = /^0x[a-fA-F0-9]{40}$/;
const BECH_RE = /^bc1[ac-hj-np-z02-9]{11,71}$/i;

// Returns an array of chain ids the address could belong to (EVM → all EVM chains)
function detectChains(address) {
  const a = String(address || '').trim();
  if (EVM_RE.test(a)) return Object.values(CHAINS).filter(c => c.family === 'evm').map(c => c.id);
  if (BECH_RE.test(a)) return ['bitcoin'];

  const chk = b58.decodeCheck(a);
  if (chk && a.length >= 26 && a.length <= 35) {
    if (chk.version === 0x41 && a.startsWith('T') && a.length === 34) return ['tron'];
    if ((chk.version === 0x00 || chk.version === 0x05) && /^[13]/.test(a)) return ['bitcoin'];
  }
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) {
    const raw = b58.decode(a);
    if (raw && raw.length === 32) return ['solana'];
  }
  return [];
}

function resolveChain(address, requested) {
  const a = String(address || '').trim();
  const candidates = detectChains(a);
  if (!candidates.length) {
    return { error: 'That does not look like an Ethereum/EVM, Bitcoin, Solana or Tron address.' };
  }
  if (requested && requested !== 'auto') {
    if (!CHAINS[requested]) return { error: `Unknown network "${requested}".` };
    if (!candidates.includes(requested)) {
      return { error: `That address is not a valid ${CHAINS[requested].name} address.` };
    }
    return { chain: CHAINS[requested], address: a, candidates };
  }
  return { chain: CHAINS[candidates[0]], address: a, candidates };
}

function explorerAddressUrl(chain, address) {
  switch (chain.family) {
    case 'utxo':   return `${chain.explorer}/address/${address}`;
    case 'solana': return `${chain.explorer}/account/${address}`;
    case 'tron':   return `${chain.explorer}/#/address/${address}`;
    default:       return `${chain.explorer}/address/${address}`;
  }
}

function explorerTxUrl(chain, hash) {
  switch (chain.family) {
    case 'utxo':   return `${chain.explorer}/tx/${hash}`;
    case 'solana': return `${chain.explorer}/tx/${hash}`;
    case 'tron':   return `${chain.explorer}/#/transaction/${hash}`;
    default:       return `${chain.explorer}/tx/${hash}`;
  }
}

// Addresses are case-insensitive on EVM only; everywhere else case matters
function normAddr(chain, a) {
  if (!a) return a;
  return chain.family === 'evm' ? a.toLowerCase() : a;
}

module.exports = { CHAINS, detectChains, resolveChain, explorerAddressUrl, explorerTxUrl, normAddr };
