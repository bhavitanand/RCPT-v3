// Tron via TronGrid (works without a key at low rate; set TRONGRID_API_KEY for more)
// Tron matters for ransomware/scam tracing because USDT-TRC20 is the dominant stablecoin rail.
const { request } = require('./http');
const { tronHexToBase58 } = require('../lib/base58');

const BASE = 'https://api.trongrid.io';
const headers = () => (process.env.TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY } : {});

async function fetchAddress(chain, address, { limit = 100 } = {}) {
  const warnings = [];
  const get = (path, params) => request({ url: `${BASE}${path}`, params, headers: headers() }).then(r => r.data);

  const [acct, native, trc20] = await Promise.all([
    get(`/v1/accounts/${address}`).catch(() => null),
    get(`/v1/accounts/${address}/transactions`, { limit: Math.min(limit, 200), only_confirmed: true, order_by: 'block_timestamp,desc' }),
    get(`/v1/accounts/${address}/transactions/trc20`, { limit: Math.min(limit, 200), only_confirmed: true, order_by: 'block_timestamp,desc' })
      .catch(err => { warnings.push(`TRC-20 transfers unavailable: ${err.message}`); return { data: [] }; }),
  ]);

  const transactions = [];
  (native.data || []).forEach(tx => {
    const c = tx.raw_data && tx.raw_data.contract && tx.raw_data.contract[0];
    if (!c || c.type !== 'TransferContract') return;
    if (tx.ret && tx.ret[0] && tx.ret[0].contractRet !== 'SUCCESS') return;
    const v = c.parameter.value;
    const amount = Number(v.amount) / 1e6;
    if (!(amount > 0)) return;
    transactions.push({ hash: tx.txID, from: tronHexToBase58(v.owner_address), to: tronHexToBase58(v.to_address), amount, symbol: 'TRX', token: null, timestamp: tx.block_timestamp });
  });
  (trc20.data || []).forEach(tx => {
    const dec = Number(tx.token_info && tx.token_info.decimals) || 0;
    const amount = Number(tx.value) / Math.pow(10, dec);
    if (!(amount > 0)) return;
    const sym = (tx.token_info && tx.token_info.symbol) || 'TRC20';
    transactions.push({ hash: tx.transaction_id, from: tx.from, to: tx.to, amount, symbol: sym, token: sym, timestamp: tx.block_timestamp });
  });

  const balance = acct && acct.data && acct.data[0] ? (acct.data[0].balance || 0) / 1e6 : null;
  return { transactions, balance, truncated: (native.data || []).length >= limit, warnings };
}

module.exports = { fetchAddress };
