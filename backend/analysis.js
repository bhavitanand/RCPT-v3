// analysis.js — orchestrates: fetch → normalise → price → label → detect → summarise
const { CHAINS, normAddr, explorerAddressUrl, explorerTxUrl } = require('./chains');
const providers = require('./providers');
const { getPricer } = require('./prices');
const labels = require('./labels');
const demo = require('./demo');
const { detectAll, PATTERNS, bandOf, short } = require('./detection');

const MAX_EXPAND = { evm: 5, utxo: 5, tron: 4, solana: 2 };

function dedupe(txs) {
  const seen = new Set();
  return txs.filter(t => {
    const k = `${t.hash}|${t.from}|${t.to}|${t.amount}|${t.symbol}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}

function buildGraph(txs, profileOf, labelOf, target) {
  const nodes = new Map(), edges = new Map();
  const node = a => {
    if (!nodes.has(a)) {
      const p = profileOf.get(a); const l = labelOf(a);
      nodes.set(a, { id: a, label: short(a), isTarget: a === target, riskScore: p ? p.riskScore : 0, severity: p ? p.severity : null,
        category: l ? l.category : null, labelName: l ? l.name : null, txCount: 0, volumeUsd: 0 });
    }
    return nodes.get(a);
  };
  txs.forEach(t => {
    const s = node(t.from), d = node(t.to);
    s.txCount++; d.txCount++; s.volumeUsd += t.usd || 0; d.volumeUsd += t.usd || 0;
    const k = `${t.from}>${t.to}>${t.symbol}`;
    if (!edges.has(k)) edges.set(k, { id: `e${edges.size}`, source: t.from, target: t.to, symbol: t.symbol, amount: 0, usd: 0, events: [] });
    const e = edges.get(k);
    e.amount += t.amount; e.usd += t.usd || 0;
    e.events.push({ ts: t.timestamp, amount: t.amount, usd: t.usd, hash: t.hash });
  });
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

function summarise(chain, target, txs, lookupFn) {
  const own = txs.filter(t => t.from === target || t.to === target);
  const byAsset = new Map();
  let sentUsd = 0, recvUsd = 0;
  const cps = new Map();
  own.forEach(t => {
    const out = t.from === target;
    const a = byAsset.get(t.symbol) || { symbol: t.symbol, sent: 0, received: 0, count: 0 };
    a[out ? 'sent' : 'received'] += t.amount; a.count++;
    byAsset.set(t.symbol, a);
    if (out) sentUsd += t.usd || 0; else recvUsd += t.usd || 0;

    const other = out ? t.to : t.from;
    if (!cps.has(other)) cps.set(other, { address: other, sentUsd: 0, receivedUsd: 0, sent: 0, received: 0, txCount: 0, firstTs: t.timestamp, lastTs: t.timestamp });
    const c = cps.get(other);
    c.txCount++; c.firstTs = Math.min(c.firstTs, t.timestamp); c.lastTs = Math.max(c.lastTs, t.timestamp);
    if (out) { c.sentUsd += t.usd || 0; c.sent += t.amount; } else { c.receivedUsd += t.usd || 0; c.received += t.amount; }
  });

  const counterparties = [...cps.values()].map(c => {
    const l = lookupFn(chain.id, c.address);
    return { ...c, label: l || null, explorerUrl: explorerAddressUrl(chain, c.address) };
  }).sort((a, b) => (b.sentUsd + b.receivedUsd) - (a.sentUsd + a.receivedUsd) || b.txCount - a.txCount);

  // where did the money end up: every traced payment into a known address, plus the target's own unlabelled sends
  const buckets = { exchange: 0, mixer: 0, flagged: 0, bridge: 0, unlabelled: 0 };
  txs.forEach(t => {
    const l = lookupFn(chain.id, t.to);
    const cat = l && l.category;
    const usd = t.usd || 0;
    if (cat === 'exchange') buckets.exchange += usd;
    else if (cat === 'mixer' || cat === 'sanctioned_mixer') buckets.mixer += usd;
    else if (cat && ['ransomware', 'sanctioned', 'scam', 'darknet'].includes(cat)) buckets.flagged += usd;
    else if (cat === 'bridge') buckets.bridge += usd;
    else if (t.from === target) buckets.unlabelled += usd;
  });

  const times = own.map(t => t.timestamp);
  return {
    stats: {
      txCount: own.length,
      totalSentUsd: sentUsd, totalReceivedUsd: recvUsd,
      byAsset: [...byAsset.values()],
      uniqueCounterparties: cps.size,
      firstSeen: times.length ? Math.min(...times) : null,
      lastSeen: times.length ? Math.max(...times) : null,
    },
    counterparties,
    outflow: buckets,
  };
}

// Union the co-spend groups that touch the target into one "probably the same owner" set
function linkedWallets(target, groups) {
  if (!groups || !groups.length) return null;
  const set = new Set([target]);
  let grew = true, used = new Set();
  while (grew) {
    grew = false;
    groups.forEach((g, i) => {
      if (!used.has(i) && g.some(a => set.has(a))) { g.forEach(a => set.add(a)); used.add(i); grew = true; }
    });
  }
  if (set.size < 2) return null;
  return { addresses: [...set].filter(a => a !== target).slice(0, 40), transactions: used.size,
    basis: 'These wallets signed the same transaction(s) as the investigated wallet. On Bitcoin that usually means one owner controls them, but it is a heuristic and can be wrong (for example with shared custody services).' };
}

function finalise({ chain, target, txs, balance, truncated, warnings, source, pricer, lookupFn, extra = {}, coSpend }) {
  const priced = txs.map(t => ({ ...t, usd: pricer.usd(t.amount, t.symbol, t.token) }));
  const { flatFlags, profiles } = detectAll({ txs: priced, target, chainId: chain.id, lookup: lookupFn });
  const profileOf = new Map(profiles.map(p => [p.wallet, p]));
  const targetProfile = profileOf.get(target);
  const score = targetProfile ? targetProfile.riskScore : 0;
  const band = bandOf(score);
  const sum = summarise(chain, target, priced, lookupFn);
  const graph = buildGraph(priced, profileOf, a => lookupFn(chain.id, a), target);

  const transactions = priced
    .filter(t => t.from === target || t.to === target)
    .sort((a, b) => b.timestamp - a.timestamp)
    .map(t => ({ ...t, direction: t.from === target ? 'out' : 'in', explorerUrl: explorerTxUrl(chain, t.hash) }));

  const covered = new Set(flatFlags.map(f => f.type));
  return {
    meta: {
      chain: chain.id, chainName: chain.name, symbol: chain.symbol, address: target,
      explorerUrl: explorerAddressUrl(chain, target),
      source, fetchedAt: Date.now(), truncated: !!truncated,
      priceSource: pricer.source, nativePriceUsd: pricer.nativePrice,
      balance: balance ?? null,
      warnings: warnings || [],
      ...extra,
    },
    verdict: { score, ...band, signals: covered.size },
    linked: linkedWallets(target, coSpend),
    ...sum,
    graph,
    transactions,
    flags: flatFlags,
    profiles,
    patterns: Object.fromEntries([...covered].map(k => [k, PATTERNS[k]]).filter(([, v]) => v)),
  };
}

async function analyzeLive(chain, address, { depth = 1 } = {}) {
  const target = normAddr(chain, address);
  const warnings = [];
  const pricer = await getPricer(chain);

  const base = await providers.fetchAddress(chain, address, {});
  warnings.push(...base.warnings);
  let txs = base.transactions.map(t => ({ ...t, from: normAddr(chain, t.from), to: normAddr(chain, t.to) }));
  if (!txs.some(t => t.from === target || t.to === target)) {
    const e = new Error(`No transfers involving this address were found on ${chain.name}. It may be unused, a program or contract account, or it may live on a different network.`);
    e.status = 404; throw e;
  }

  let expanded = 0;
  if (depth >= 2) {
    const volume = new Map();
    txs.forEach(t => {
      const other = t.from === target ? t.to : t.from;
      volume.set(other, (volume.get(other) || 0) + (pricer.usd(t.amount, t.symbol, t.token) || t.amount));
    });
    const picks = [...volume.entries()].sort((a, b) => b[1] - a[1])
      .map(([a]) => a).filter(a => !labels.lookup(chain.id, a) || labels.lookup(chain.id, a).category !== 'exchange')
      .slice(0, MAX_EXPAND[chain.family] || 3);
    for (const a of picks) {
      try {
        const r = await providers.fetchAddress(chain, a, { limit: 40 });
        txs.push(...r.transactions.map(t => ({ ...t, from: normAddr(chain, t.from), to: normAddr(chain, t.to) })));
        expanded++;
      } catch (err) { warnings.push(`Could not follow ${short(a)}: ${err.message}`); }
    }
  }
  txs = dedupe(txs);
  return finalise({ chain, target, txs, balance: base.balance, truncated: base.truncated, warnings, source: 'live', pricer, lookupFn: labels.lookup, coSpend: base.coSpend,
    extra: { depth: expanded ? 2 : 1, followedWallets: expanded } });
}

function analyzeDemo(id) {
  const d = demo.build(id);
  if (!d) { const e = new Error('Unknown demo scenario.'); e.status = 404; throw e; }
  const chain = CHAINS[d.scenario.chain];
  const lookupFn = (cid, a) => {
    const hit = d.labels[a];
    if (hit) {
      const meta = labels.CATEGORIES[hit.category] || { label: hit.category, risk: 0, tone: 'info' };
      return { name: hit.name, category: hit.category, categoryLabel: meta.label, risk: meta.risk, tone: meta.tone, source: hit.source };
    }
    return null;
  };
  const pricer = { source: 'approx', nativePrice: chain.fallbackUsd, usd: (amt, sym, token) => (token ? null : amt * chain.fallbackUsd) };
  return finalise({ chain, target: d.target, txs: d.transactions, balance: d.balance, truncated: false,
    warnings: ['SIMULATED DATA: this scenario was generated for demonstration. The addresses are not real wallets.'],
    source: 'demo', pricer, lookupFn, extra: { demoId: id, demoTitle: d.scenario.title } });
}

module.exports = { analyzeLive, analyzeDemo, linkedWallets };
