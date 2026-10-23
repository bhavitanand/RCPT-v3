// demo.js — clearly-labelled SIMULATED scenarios so the product can be shown without API keys.
// Addresses are random, not real wallets, and nothing here is ever mixed with live data.

function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const HEX = '0123456789abcdef';
const B32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const pick = (r, set, n) => Array.from({ length: n }, () => set[Math.floor(r() * set.length)]).join('');

const addr = {
  evm: r => '0x' + pick(r, HEX, 40),
  bitcoin: r => 'bc1q' + pick(r, B32, 38),
  solana: r => pick(r, B58, 44),
  tron: r => 'T' + pick(r, B58, 33),
};
const hash = (r, fam) => (fam === 'evm' ? '0x' + pick(r, HEX, 64) : fam === 'bitcoin' ? pick(r, HEX, 64) : pick(r, B58, 88));

const SCENARIOS = {
  ransomware: {
    id: 'ransomware', chain: 'ethereum', family: 'evm', seed: 7,
    title: 'Ransomware collection wallet',
    blurb: 'Eight victims pay one wallet, which fans out through a hop chain into a mixer and an exchange.',
  },
  peel: {
    id: 'peel', chain: 'bitcoin', family: 'bitcoin', seed: 21,
    title: 'Bitcoin peel chain',
    blurb: 'A big balance moves wallet to wallet, shedding small slices each time, before landing at an exchange.',
  },
  ordinary: {
    id: 'ordinary', chain: 'solana', family: 'solana', seed: 3,
    title: 'Ordinary everyday wallet',
    blurb: 'A normal wallet paying friends and a shop. Shows what a quiet result looks like.',
  },
};

function build(id, now = Date.now()) {
  const sc = SCENARIOS[id];
  if (!sc) return null;
  const r = rng(sc.seed);
  const A = () => addr[sc.family](r);
  const H = () => hash(r, sc.family);
  const T0 = now - 9 * 24 * 3600e3;
  const txs = [];
  const add = (from, to, amount, ts, symbol, token = null) => txs.push({ hash: H(), from, to, amount, symbol, token, timestamp: Math.round(ts) });
  const labels = {};
  let target;

  if (id === 'ransomware') {
    target = A();
    const victims = Array.from({ length: 8 }, A);
    victims.forEach((v, i) => add(v, target, [0.5, 1, 1, 2, 0.5, 1.5, 2, 1][i], T0 + i * 55 * 60e3 + r() * 20 * 60e3, 'ETH'));
    const hop = Array.from({ length: 4 }, A);
    const side = Array.from({ length: 6 }, A);
    const mixer = A(), exchange = A();
    labels[mixer] = { name: 'Simulated mixer pool', category: 'mixer', source: 'Demo data' };
    labels[exchange] = { name: 'Simulated Exchange hot wallet', category: 'exchange', source: 'Demo data' };
    const sweep = T0 + 9 * 3600e3;
    add(target, hop[0], 7.6, sweep, 'ETH');
    add(target, side[0], 0.4, sweep + 4 * 60e3, 'ETH');
    add(target, side[1], 0.3, sweep + 9 * 60e3, 'ETH');
    add(hop[0], hop[1], 6.9, sweep + 25 * 60e3, 'ETH');
    add(hop[0], side[2], 0.5, sweep + 28 * 60e3, 'ETH');
    add(hop[1], hop[2], 6.2, sweep + 70 * 60e3, 'ETH');
    add(hop[1], side[3], 0.6, sweep + 74 * 60e3, 'ETH');
    add(hop[2], mixer, 5, sweep + 3 * 3600e3, 'ETH');
    add(hop[2], hop[3], 1.1, sweep + 3.1 * 3600e3, 'ETH');
    add(hop[3], exchange, 1.05, sweep + 5 * 3600e3, 'ETH');
    add(target, side[4], 1, sweep + 6 * 3600e3, 'ETH');
    add(target, side[5], 1, sweep + 6.1 * 3600e3, 'ETH');
  } else if (id === 'peel') {
    target = A();
    const src = A(), exchange = A();
    labels[exchange] = { name: 'Simulated Exchange deposit', category: 'exchange', source: 'Demo data' };
    const chain = [target, ...Array.from({ length: 5 }, A)];
    add(src, target, 12.5, T0, 'BTC');
    let bal = 12.5, t = T0 + 40 * 60e3;
    for (let i = 0; i < chain.length - 1; i++) {
      const peel = +(bal * (0.04 + r() * 0.05)).toFixed(4);
      const side = A();
      add(chain[i], chain[i + 1], +(bal - peel).toFixed(4), t, 'BTC');
      add(chain[i], side, peel, t + 1000, 'BTC');
      bal = +(bal - peel).toFixed(4);
      t += (35 + r() * 20) * 60e3;
    }
    add(chain[chain.length - 1], exchange, bal, t, 'BTC');
  } else {
    target = A();
    const friends = Array.from({ length: 4 }, A), shop = A(), job = A();
    for (let i = 0; i < 6; i++) add(job, target, 4, T0 - 20 * 24 * 3600e3 + i * 6 * 24 * 3600e3, 'SOL');
    friends.forEach((f, i) => add(target, f, +(0.2 + r() * 0.7).toFixed(2), T0 + i * 31 * 3600e3 + r() * 3600e3, 'SOL'));
    add(target, shop, 0.85, T0 + 5 * 24 * 3600e3, 'SOL');
  }

  txs.sort((a, b) => a.timestamp - b.timestamp);
  return { scenario: sc, target, transactions: txs, labels, balance: id === 'ordinary' ? 12.4 : 0.2 };
}

module.exports = { SCENARIOS, build };
