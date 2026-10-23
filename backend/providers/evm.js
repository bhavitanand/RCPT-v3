// EVM chains via Etherscan API V2 (one key, many chains)
const { request, sleep } = require('./http');

const BASE = 'https://api.etherscan.io/v2/api';

// Etherscan's free plan allows ~3 calls/second per key. Every call in the process goes through this
// queue (one at a time, 400 ms apart) and retries when Etherscan still says "rate limit".
let queue = Promise.resolve();
let lastCall = 0;
function throttled(fn) {
  const run = queue.then(async () => {
    const wait = Math.max(0, lastCall + 400 - Date.now());
    if (wait) await sleep(wait);
    lastCall = Date.now();
    return fn();
  });
  queue = run.catch(() => undefined);
  return run;
}

async function call(chain, params) {
  const key = process.env.ETHERSCAN_API_KEY;
  if (!key) {
    const e = new Error('ETHERSCAN_API_KEY is not set on the server.');
    e.status = 503;
    throw e;
  }
  for (let attempt = 0; ; attempt++) {
    const { data } = await throttled(() => request({
      url: BASE,
      params: { chainid: chain.evmChainId, apikey: key, ...params },
    }));
    const result = typeof data.result === 'string' ? data.result : '';
    if ((data.status === '0' || /rate limit/i.test(result)) && /rate limit/i.test(`${data.message || ''} ${result}`) && attempt < 4) {
      await sleep(900 * (attempt + 1));
      continue;
    }
    // status "0" + "No transactions found" is a normal empty result
    if (data.status === '0') {
      const msg = String(data.message || '');
      if (/no transactions found/i.test(msg) || /no transactions found/i.test(result)) return [];
      const e = new Error(
        /free api access is not supported|upgrade/i.test(result)
          ? `${chain.name} data needs a paid Etherscan plan. Ethereum works on the free plan.`
          : /rate limit/i.test(result)
            ? 'Etherscan is rate-limiting this key. Wait a few seconds and try again.'
            : `Etherscan said: ${result || msg || 'unknown error'}`
      );
      e.status = 502;
      throw e;
    }
    return data.result;
  }
}

async function fetchAddress(chain, address, { limit = 100 } = {}) {
  const warnings = [];
  const common = { module: 'account', address, startblock: 0, endblock: 99999999, sort: 'desc', page: 1, offset: limit };

  // the shared queue keeps these inside Etherscan's rate limit even though they are started together
  const [native, tokens, bal] = await Promise.all([
    call(chain, { ...common, action: 'txlist' }),
    call(chain, { ...common, action: 'tokentx' }).catch(err => { warnings.push(`Token transfers unavailable: ${err.message}`); return []; }),
    call(chain, { module: 'account', action: 'balance', address, tag: 'latest' }).catch(() => null),
  ]);

  const transactions = [];
  native.forEach(tx => {
    if (tx.isError === '1') return;
    const amount = Number(tx.value) / 1e18;
    if (amount <= 0 || !tx.to) return;
    transactions.push({ hash: tx.hash, from: tx.from, to: tx.to, amount, symbol: chain.symbol, token: null, timestamp: Number(tx.timeStamp) * 1000 });
  });
  tokens.forEach(tx => {
    const dec = Number(tx.tokenDecimal) || 0;
    const amount = Number(tx.value) / Math.pow(10, dec);
    if (!(amount > 0)) return;
    transactions.push({ hash: tx.hash, from: tx.from, to: tx.to, amount, symbol: tx.tokenSymbol || 'TOKEN', token: tx.tokenSymbol || 'TOKEN', timestamp: Number(tx.timeStamp) * 1000 });
  });

  return {
    transactions,
    balance: bal ? Number(bal) / 1e18 : null,
    truncated: native.length >= limit || tokens.length >= limit,
    warnings,
  };
}

// Cheap probe used by the cross-network scan
async function hasActivity(chain, address) {
  const r = await call(chain, { module: 'account', action: 'txlist', address, startblock: 0, endblock: 99999999, sort: 'desc', page: 1, offset: 1 });
  return { active: r.length > 0, lastSeen: r[0] ? Number(r[0].timeStamp) * 1000 : null };
}

module.exports = { fetchAddress, hasActivity, call };
