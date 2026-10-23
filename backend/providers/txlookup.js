// Look up one transaction by hash and report who paid whom. Lets a victim start from a receipt.
const { request } = require('./http');
const { CHAINS } = require('../chains');
const { hashKind } = require('../extract');
const { tronHexToBase58 } = require('../lib/base58');
const solana = require('./solana');
const evm = require('./evm');

async function evmTx(hash) {
  if (!process.env.ETHERSCAN_API_KEY) { const e = new Error('ETHERSCAN_API_KEY is not set on the server.'); e.status = 503; throw e; }
  for (const chain of Object.values(CHAINS).filter(c => c.family === 'evm')) {
    try {
      const t = await evm.call(chain, { module: 'proxy', action: 'eth_getTransactionByHash', txhash: hash });
      if (t && typeof t === 'object' && t.from) {
        const block = await evm.call(chain, { module: 'proxy', action: 'eth_getBlockByNumber', tag: t.blockNumber, boolean: 'false' }).catch(() => null);
        return { chain, time: block ? parseInt(block.timestamp, 16) * 1000 : null,
          transfers: [{ from: t.from, to: t.to, amount: Number(BigInt(t.value || '0x0')) / 1e18, symbol: chain.symbol }],
          note: t.input && t.input !== '0x' ? 'This transaction also called a smart contract, so token movements may not be shown here. Trace the sender or receiver for the full picture.' : null };
      }
    } catch { /* try the next network */ }
  }
  return null;
}

async function btcTx(hash) {
  try {
    const { data: t } = await request({ url: `${process.env.BTC_API_BASE || 'https://mempool.space/api'}/tx/${hash}` }, { retries: 0 });
    const ins = {}; (t.vin || []).forEach(v => { const a = v.prevout && v.prevout.scriptpubkey_address; if (a) ins[a] = (ins[a] || 0) + v.prevout.value; });
    const senders = Object.keys(ins);
    const transfers = [];
    (t.vout || []).forEach(o => { if (o.scriptpubkey_address) senders.slice(0, 1).forEach(s => transfers.push({ from: senders.length > 1 ? `${s} (+${senders.length - 1} more)` : s, to: o.scriptpubkey_address, amount: o.value / 1e8, symbol: 'BTC' })); });
    return { chain: CHAINS.bitcoin, time: t.status && t.status.block_time ? t.status.block_time * 1000 : null, transfers, senders, note: senders.length > 1 ? 'Several wallets contributed inputs to this transaction.' : null };
  } catch { return null; }
}

async function tronTx(hash) {
  try {
    const { data: t } = await request({ method: 'post', url: 'https://api.trongrid.io/wallet/gettransactionbyid', data: { value: hash }, headers: process.env.TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY } : {} }, { retries: 0 });
    const c = t && t.raw_data && t.raw_data.contract && t.raw_data.contract[0];
    if (!c) return null;
    if (c.type === 'TransferContract') {
      const v = c.parameter.value;
      return { chain: CHAINS.tron, time: t.raw_data.timestamp, transfers: [{ from: tronHexToBase58(v.owner_address), to: tronHexToBase58(v.to_address), amount: v.amount / 1e6, symbol: 'TRX' }] };
    }
    if (c.type === 'TriggerSmartContract') {
      const v = c.parameter.value; // TRC-20 transfers: recipient and amount live in the call data
      const data = v.data || '';
      if (data.startsWith('a9059cbb') && data.length >= 136) {
        const to = tronHexToBase58('41' + data.slice(32, 72));
        const amount = Number(BigInt('0x' + data.slice(72, 136))) / 1e6; // USDT/USDC use 6 decimals; others may differ
        return { chain: CHAINS.tron, time: t.raw_data.timestamp, transfers: [{ from: tronHexToBase58(v.owner_address), to, amount, symbol: 'TRC-20 token' }], note: 'Token decimals are assumed to be 6 (true for USDT and USDC on Tron).' };
      }
    }
    return null;
  } catch { return null; }
}

async function solTx(hash) {
  try {
    const { data } = await request({ method: 'post', url: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', data: { jsonrpc: '2.0', id: 1, method: 'getTransaction', params: [hash, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }] } }, { retries: 1 });
    if (!data.result) return null;
    const ts = (data.result.blockTime || 0) * 1000;
    return { chain: CHAINS.solana, time: ts || null, transfers: solana.pickTransfers(data.result, hash, ts).map(t => ({ from: t.from, to: t.to, amount: t.amount, symbol: t.symbol })) };
  } catch { return null; }
}

async function lookupTx(hash) {
  const kind = hashKind(hash);
  if (!kind) { const e = new Error('That does not look like a transaction hash.'); e.status = 400; throw e; }
  let r = null;
  if (kind === 'evm') r = await evmTx(hash);
  else if (kind === 'hex64') r = (await btcTx(hash)) || (await tronTx(hash));
  else r = await solTx(hash);
  if (!r) { const e = new Error('We could not find that transaction on any supported network. Check the hash and try again.'); e.status = 404; throw e; }
  return { hash, network: r.chain.id, networkName: r.chain.name, time: r.time, transfers: r.transfers.slice(0, 12), note: r.note || null };
}

module.exports = { lookupTx };
