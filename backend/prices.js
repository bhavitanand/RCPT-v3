// prices.js — USD prices from CoinGecko's free endpoint, cached 5 min, with static fallbacks
const { request } = require('./providers/http');
const { CHAINS } = require('./chains');

const STABLES = new Set(['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'USDD', 'FDUSD', 'PYUSD', 'USDE', 'USDP']);
const TTL = 5 * 60 * 1000;
let cache = { at: 0, prices: {} };

async function refresh() {
  if (Date.now() - cache.at < TTL) return;
  const ids = [...new Set(Object.values(CHAINS).map(c => c.cgId))].join(',');
  try {
    const { data } = await request(
      { url: 'https://api.coingecko.com/api/v3/simple/price', params: { ids, vs_currencies: 'usd' } },
      { retries: 0, timeout: 5000 }
    );
    cache = { at: Date.now(), prices: data };
  } catch {
    cache.at = Date.now() - TTL + 30 * 1000; // back off 30 s before retrying
  }
}

// Returns { priceOf(symbol, chain) → number|null, source: 'live'|'approx' }
async function getPricer(chain) {
  await refresh();
  const live = cache.prices[chain.cgId] && cache.prices[chain.cgId].usd;
  const nativePrice = live || chain.fallbackUsd;
  return {
    source: live ? 'live' : 'approx',
    nativePrice,
    usd(amount, symbol, token) {
      if (token) return STABLES.has(String(symbol).toUpperCase()) ? amount : null; // unknown tokens: no USD value
      return amount * nativePrice;
    },
  };
}

module.exports = { getPricer, STABLES };
