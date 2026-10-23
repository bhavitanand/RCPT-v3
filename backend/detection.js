// detection.js — chain-agnostic detection engine (v3)
//
// Input  : normalised payments  { hash, from, to, amount, usd|null, symbol, token, timestamp(ms) }
// Output : flags (each with plain-English text + evidence tx hashes) and per-wallet risk profiles.
//
// Signals combine with a "noisy-or": 1 - Π(1 - s/100). Several weak signals add up, but a score
// never exceeds 100 and one very strong signal (e.g. a ransomware label) dominates.

const HOUR = 3600e3;
const DAY = 24 * HOUR;

const WEIGHTS = {
  splitting_moderate: 25, splitting_severe: 40,
  consolidation_moderate: 20, consolidation_severe: 35,
  chaining_rapid: 35, chaining_normal: 10,
  peel_chain: 40,
  large_medium: 15, large_high: 30,
  velocity: 20,
  round_amount: 10,
  dormant_burst: 15,
  dust: 5,
  neighbour_risk: 20,
};

const LABEL_WEIGHTS = { // risk added to a wallet that deals with a labelled address
  ransomware: 70, sanctioned: 60, sanctioned_mixer: 60, mixer: 50, scam: 50, darknet: 45, bridge: 5,
};

// Everything the UI/Gemini/Learn page needs to explain a pattern without re-deriving it
const PATTERNS = {
  splitting:        { title: 'Splitting (fan-out)',        short: 'Money divided across many wallets quickly',
    why: 'Criminals split one large sum into many small payments so no single wallet looks important and each piece is harder to follow.' },
  consolidation:    { title: 'Consolidation (fan-in)',     short: 'Many wallets paying into one',
    why: 'A ransomware gang often gives every victim a different payment address, then sweeps them all into one collection wallet. Many senders into one wallet in a short time looks like that.' },
  chaining:         { title: 'Rapid hopping',              short: 'Money forwarded almost immediately',
    why: 'Passing funds through wallet after wallet within minutes adds distance between the payment and the final cash-out. Normal users rarely do this.' },
  peel_chain:       { title: 'Peel chain',                 short: 'Small slices peeled off a moving balance',
    why: 'Each hop sends most of the balance onward and "peels" a small amount to another wallet. It is a classic way to move large sums while blending in.' },
  large:            { title: 'Large transfer',             short: 'Unusually large amounts',
    why: 'Large single transfers deserve attention because they are where most of the value (and loss) is concentrated.' },
  velocity:         { title: 'Burst of activity',          short: 'Many transactions in one hour',
    why: 'Automated tools or scripted laundering produce unusually dense bursts of transactions.' },
  round_amount:     { title: 'Round amounts',              short: 'Suspiciously tidy numbers',
    why: 'Ransom demands and structured payments are often set to round figures, unlike organic purchases which are rarely tidy.' },
  dormant_burst:    { title: 'Sleeping wallet wakes up',   short: 'Long silence, then a burst',
    why: 'Wallets that sit idle for months and then suddenly move funds can indicate stored proceeds being cashed out.' },
  dust:             { title: 'Dust',                       short: 'Tiny unsolicited payments',
    why: 'Tiny amounts from many senders can be used to track wallets or to poison transaction history with look-alike addresses.' },
  known_label:      { title: 'Known bad address',          short: 'Appears on a watchlist',
    why: 'This address appears on a public watchlist (e.g. ransomware campaigns or sanctions lists).' },
  label_exposure:   { title: 'Dealt with a watchlisted address', short: 'Direct link to a flagged address',
    why: 'Sending to or receiving from watchlisted addresses (mixers, sanctioned services, known ransomware wallets) is one of the strongest signals available.' },
  exchange_exposure:{ title: 'Reached an exchange',        short: 'Funds arrived at a known exchange',
    why: 'Exchanges collect identity information. This is where investigators can ask for account details with legal process, so it is useful, not a warning sign by itself.' },
  downstream_exposure: { title: 'Money trail leads to a flagged address', short: 'Funds eventually reach a watchlisted address',
    why: 'Even when a wallet never touches a mixer or sanctioned service directly, funds can reach one a few hops later. Following the money forward exposes that.' },
  neighbour_risk:   { title: 'High-risk neighbour',        short: 'Linked directly to a risky wallet',
    why: 'This wallet transacted directly with another wallet that scored high-risk.' },
};

const fmtUsd = n => (n == null ? '' : n >= 1000 ? `$${Math.round(n).toLocaleString('en-US')}` : `$${n.toFixed(2)}`);
const short = a => (a && a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

function noisyOr(scores) {
  const p = scores.reduce((acc, s) => acc * (1 - Math.min(Math.max(s, 0), 100) / 100), 1);
  return Math.round((1 - p) * 100);
}

function severityOf(score) { return score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW'; }

function bandOf(score) {
  if (score >= 70) return { band: 'high',       label: 'High risk',               headline: 'Strong signs of laundering or criminal use' };
  if (score >= 40) return { band: 'suspicious', label: 'Suspicious',              headline: 'Several warning signs, worth a closer look' };
  if (score >= 15) return { band: 'unusual',    label: 'Some unusual activity',   headline: 'A few patterns stand out, nothing conclusive' };
  return                  { band: 'ordinary',   label: 'Looks ordinary',          headline: 'No meaningful warning signs found' };
}

function indexTxs(txs) {
  const out = new Map(), inn = new Map();
  const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
  txs.forEach(t => { push(out, t.from, t); push(inn, t.to, t); });
  const byTime = (a, b) => a.timestamp - b.timestamp;
  out.forEach(v => v.sort(byTime)); inn.forEach(v => v.sort(byTime));
  return { out, inn };
}

const uniq = arr => [...new Set(arr)];
const hashes = txs => uniq(txs.map(t => t.hash)).slice(0, 12);
const val = t => (t.usd != null ? t.usd : 0);

// ─── detectors ───────────────────────────────────────────────────────────────

function detectSplitting({ out }) {
  const flags = [];
  out.forEach((list, w) => {
    let best = { n: 0, win: [] };
    for (let i = 0, j = 0; i < list.length; i++) {
      while (list[i].timestamp - list[j].timestamp > DAY) j++;
      const win = list.slice(j, i + 1);
      const n = new Set(win.map(t => t.to)).size;
      if (n > best.n) best = { n, win };
    }
    if (best.n >= 3) {
      const severe = best.n >= 6;
      flags.push({ type: 'splitting', wallet: w, score: severe ? WEIGHTS.splitting_severe : WEIGHTS.splitting_moderate,
        detail: `Sent funds to ${best.n} different wallets within 24 hours`,
        plain: `This wallet divided its money among ${best.n} different wallets in a single day. Splitting like this is a common way to make a trail harder to follow.`,
        evidence: hashes(best.win), usd: best.win.reduce((s, t) => s + val(t), 0) || undefined });
    }
  });
  return flags;
}

function detectConsolidation({ inn }) {
  const flags = [];
  inn.forEach((list, w) => {
    let best = { n: 0, win: [] };
    for (let i = 0, j = 0; i < list.length; i++) {
      while (list[i].timestamp - list[j].timestamp > DAY) j++;
      const win = list.slice(j, i + 1);
      const n = new Set(win.map(t => t.from)).size;
      if (n > best.n) best = { n, win };
    }
    if (best.n >= 5) {
      const severe = best.n >= 10;
      const total = best.win.reduce((s, t) => s + val(t), 0);
      flags.push({ type: 'consolidation', wallet: w, score: severe ? WEIGHTS.consolidation_severe : WEIGHTS.consolidation_moderate,
        detail: `Received funds from ${best.n} different wallets within 24 hours`,
        plain: `${best.n} different wallets paid into this one within a day${total ? ` (about ${fmtUsd(total)} in total)` : ''}. Ransomware operators often gather victim payments into a single collection wallet exactly like this.`,
        evidence: hashes(best.win), usd: total || undefined });
    }
  });
  return flags;
}

function detectChaining({ out, inn }) {
  const flags = [];
  out.forEach((outs, w) => {
    const ins = inn.get(w);
    if (!ins) return;
    let rapid = null, slow = false;
    outs.forEach(o => {
      // funds received in the 1h before this payment
      const recent = ins.filter(i => i.timestamp <= o.timestamp && o.timestamp - i.timestamp <= HOUR && i.symbol === o.symbol);
      if (recent.length) {
        const got = recent.reduce((s, i) => s + i.amount, 0);
        if (o.amount >= 0.7 * got && !rapid) rapid = { o, recent };
      } else if (ins.some(i => i.timestamp <= o.timestamp)) slow = true;
    });
    if (rapid) {
      const mins = Math.max(1, Math.round((rapid.o.timestamp - rapid.recent[0].timestamp) / 60000));
      flags.push({ type: 'chaining', wallet: w, score: WEIGHTS.chaining_rapid,
        detail: 'Forwarded most of what it received within 1 hour',
        plain: `This wallet received money and passed nearly all of it on within ${mins < 60 ? mins + ' minute' + (mins === 1 ? '' : 's') : 'the hour'}. Wallets that simply relay funds are often stepping stones in a laundering route.`,
        evidence: hashes([...rapid.recent, rapid.o]) });
    } else if (slow) {
      flags.push({ type: 'chaining', wallet: w, score: WEIGHTS.chaining_normal,
        detail: 'Both receives and forwards funds',
        plain: 'This wallet both receives and sends money onward. On its own that is common (people spend what they receive), so it only adds a small amount of risk.',
        evidence: hashes(outs.slice(0, 3)) });
    }
  });
  return flags;
}

function detectPeelChain({ out, inn }) {
  // A "peel hop": a burst of outgoing payments where one is ≥70% and others are small slices,
  // funded by an earlier incoming payment of similar size.
  const hop = new Map();
  out.forEach((outs, w) => {
    const ins = inn.get(w) || [];
    for (let i = 0; i < outs.length; i++) {
      const cluster = outs.filter(o => o.timestamp >= outs[i].timestamp && o.timestamp - outs[i].timestamp <= HOUR && o.symbol === outs[i].symbol);
      if (cluster.length < 2) continue;
      const sum = cluster.reduce((s, o) => s + o.amount, 0);
      const top = cluster.reduce((a, b) => (b.amount > a.amount ? b : a));
      if (top.amount / sum < 0.7 || new Set(cluster.map(c => c.to)).size < 2) continue;
      const funded = ins.some(x => x.timestamp <= outs[i].timestamp && x.amount >= 0.8 * sum && x.symbol === top.symbol);
      if (!funded) continue;
      hop.set(w, { next: top.to, txs: cluster });
      break;
    }
  });
  const flags = [];
  const seenInChain = new Set();
  hop.forEach((h, start) => {
    if (seenInChain.has(start)) return;
    const path = [start]; const ev = [...h.txs];
    let cur = h.next;
    while (hop.has(cur) && !path.includes(cur) && path.length < 12) {
      path.push(cur); ev.push(...hop.get(cur).txs); cur = hop.get(cur).next;
    }
    path.forEach(p => seenInChain.add(p));
    if (path.length >= 2) {
      flags.push({ type: 'peel_chain', wallet: start, score: WEIGHTS.peel_chain,
        detail: `Peel chain across ${path.length} wallets`,
        plain: `The money moves along a chain of ${path.length} wallets. At each step most of the balance goes forward and a small slice is "peeled" off to a side wallet. This shape is typical when someone moves a large amount while trying to look like ordinary traffic.`,
        evidence: hashes(ev), path });
    }
  });
  return flags;
}

function detectLarge({ out }) {
  const flags = [];
  out.forEach((outs, w) => {
    const big = outs.filter(t => t.usd != null && t.usd >= 10000);
    if (!big.length) return;
    const max = big.reduce((a, b) => (b.usd > a.usd ? b : a));
    const high = max.usd >= 100000;
    flags.push({ type: 'large', wallet: w, score: high ? WEIGHTS.large_high : WEIGHTS.large_medium,
      detail: `Largest single payment about ${fmtUsd(max.usd)}`,
      plain: `This wallet made ${big.length === 1 ? 'a payment' : big.length + ' payments'} of ${fmtUsd(10000)} or more, the largest around ${fmtUsd(max.usd)} (${max.amount.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${max.symbol}). Big movements matter most because that is where the money is.`,
      evidence: hashes(big), usd: max.usd });
  });
  return flags;
}

function detectVelocity({ out }) {
  const flags = [];
  out.forEach((outs, w) => {
    let best = [];
    for (let i = 0, j = 0; i < outs.length; i++) {
      while (outs[i].timestamp - outs[j].timestamp > HOUR) j++;
      if (i - j + 1 > best.length) best = outs.slice(j, i + 1);
    }
    if (best.length > 5) {
      flags.push({ type: 'velocity', wallet: w, score: WEIGHTS.velocity,
        detail: `${best.length} payments within one hour`,
        plain: `${best.length} payments left this wallet inside a single hour. People don't normally move money this fast, but scripts and laundering tools do.`,
        evidence: hashes(best) });
    }
  });
  return flags;
}

function isRound(t) {
  if (t.token) return t.usd != null && t.usd >= 500 && t.amount % 100 === 0; // stablecoin, e.g. 5000 USDT
  if (t.usd != null && t.usd < 1000) return false;
  return t.amount > 0 && (t.amount % 1 === 0 || [0.1, 0.25, 0.5, 2.5, 0.01].includes(t.amount));
}

function detectRound({ out }) {
  const flags = [];
  out.forEach((outs, w) => {
    const round = outs.filter(isRound);
    if (round.length >= 2) {
      flags.push({ type: 'round_amount', wallet: w, score: WEIGHTS.round_amount,
        detail: `${round.length} payments with suspiciously round amounts`,
        plain: `${round.length} of this wallet's payments are tidy round numbers (like ${round[0].amount.toLocaleString('en-US')} ${round[0].symbol}). Real purchases rarely come out that clean; fixed ransom demands and structured payments often do.`,
        evidence: hashes(round) });
    }
  });
  return flags;
}

function detectDormantBurst(idx, allTxs) {
  const flags = [];
  const byWallet = new Map();
  allTxs.forEach(t => { [t.from, t.to].forEach(w => { if (!byWallet.has(w)) byWallet.set(w, []); byWallet.get(w).push(t); }); });
  byWallet.forEach((list, w) => {
    const ts = list.map(t => t.timestamp).sort((a, b) => a - b);
    for (let i = 1; i < ts.length; i++) {
      if (ts[i] - ts[i - 1] >= 90 * DAY) {
        const burst = ts.filter(x => x >= ts[i] && x - ts[i] <= DAY);
        if (burst.length >= 3) {
          const days = Math.round((ts[i] - ts[i - 1]) / DAY);
          flags.push({ type: 'dormant_burst', wallet: w, score: WEIGHTS.dormant_burst,
            detail: `Silent for ${days} days, then ${burst.length} transactions in a day`,
            plain: `After ${days} days of no activity this wallet suddenly made ${burst.length} transactions within 24 hours. Old holdings being cashed out all at once is a pattern worth noting.`,
            evidence: hashes(list.filter(t => t.timestamp >= ts[i] && t.timestamp - ts[i] <= DAY)) });
          break;
        }
      }
    }
  });
  return flags;
}

function detectDust({ inn }, target) {
  const list = inn.get(target) || [];
  const dust = list.filter(t => t.usd != null && t.usd > 0 && t.usd < 0.5);
  if (new Set(dust.map(t => t.from)).size < 3) return [];
  return [{ type: 'dust', wallet: target, score: WEIGHTS.dust,
    detail: `${dust.length} tiny payments from ${new Set(dust.map(t => t.from)).size} wallets`,
    plain: 'This wallet received many tiny payments (worth under 50 cents each) from different senders. That can be "dusting", used to track a wallet or to trick people into copying a look-alike address later. Usually harmless to the owner, but worth knowing.',
    evidence: hashes(dust) }];
}

function detectLabels(txs, chainId, lookup, target) {
  const flags = [];
  const labelCache = new Map();
  const L = a => { if (!labelCache.has(a)) labelCache.set(a, lookup(chainId, a)); return labelCache.get(a); };

  const wallets = new Set(); txs.forEach(t => { wallets.add(t.from); wallets.add(t.to); });
  wallets.forEach(w => {
    const l = L(w);
    if (l && l.risk >= 60) {
      flags.push({ type: 'known_label', wallet: w, score: l.risk,
        detail: `${l.name} (${l.categoryLabel})`,
        plain: `This address appears on a watchlist as "${l.name}" (${l.categoryLabel.toLowerCase()}). Source: ${l.source}.`,
        evidence: [], label: l });
    }
  });

  const grouped = new Map(); // wallet|labelledAddr|dir
  txs.forEach(t => {
    const lf = L(t.from), lt = L(t.to);
    if (lt && LABEL_WEIGHTS[lt.category] != null) addExp(t.from, t.to, lt, 'sent', t);
    if (lf && LABEL_WEIGHTS[lf.category] != null) addExp(t.to, t.from, lf, 'received', t);
    if (lt && lt.category === 'exchange') addExp(t.from, t.to, lt, 'sent', t, true);
  });
  function addExp(wallet, other, l, dir, t, exchange) {
    const k = `${wallet}|${other}|${dir}|${exchange ? 'x' : 'r'}`;
    if (!grouped.has(k)) grouped.set(k, { wallet, other, l, dir, txs: [], exchange: !!exchange });
    grouped.get(k).txs.push(t);
  }
  grouped.forEach(g => {
    const total = g.txs.reduce((s, t) => s + val(t), 0);
    const amt = total ? ` (about ${fmtUsd(total)})` : '';
    if (g.exchange) {
      flags.push({ type: 'exchange_exposure', wallet: g.wallet, score: 0,
        detail: `Sent funds to ${g.l.name}`,
        plain: `Money from this wallet arrived at ${g.l.name}${amt}. Exchanges verify customer identity, so this is a point where law enforcement can ask who owns the receiving account. It is a useful lead, not a red flag.`,
        evidence: hashes(g.txs), usd: total || undefined, label: g.l });
    } else {
      const w = LABEL_WEIGHTS[g.l.category];
      flags.push({ type: 'label_exposure', wallet: g.wallet, score: g.dir === 'sent' ? w : Math.round(w * 0.7),
        detail: `${g.dir === 'sent' ? 'Sent funds to' : 'Received funds from'} ${g.l.name} (${g.l.categoryLabel})`,
        plain: `This wallet ${g.dir === 'sent' ? 'sent money to' : 'received money from'} "${g.l.name}", which is listed as ${g.l.categoryLabel.toLowerCase()}${amt}. ${g.l.category.includes('mixer') ? 'Mixers pool funds from many people to break the visible trail, which is why they are heavily associated with laundering.' : 'Direct contact with watchlisted addresses is one of the strongest warning signs available.'}`,
        evidence: hashes(g.txs), usd: total || undefined, label: g.l });
    }
  });
  return flags;
}

// Follow the money forward from the target (time-respecting, up to 6 hops) and report any
// watchlisted address it eventually reaches. Direct contact is already covered by detectLabels.
function detectDownstream({ out }, target, chainId, lookup) {
  const flags = [];
  const best = new Map(); // address -> shortest path info
  let frontier = [{ w: target, ts: -Infinity, path: [target], txs: [] }];
  const seen = new Set([target]);
  for (let hop = 1; hop <= 6 && frontier.length; hop++) {
    const next = [];
    frontier.forEach(({ w, ts, path, txs }) => {
      (out.get(w) || []).forEach(t => {
        if (t.timestamp < ts || path.includes(t.to)) return;
        const node = { w: t.to, ts: t.timestamp, path: [...path, t.to], txs: [...txs, t] };
        if (hop >= 2 && !best.has(t.to)) best.set(t.to, { ...node, hops: hop });
        if (!seen.has(t.to)) { seen.add(t.to); next.push(node); }
      });
    });
    frontier = next.slice(0, 400);
  }
  best.forEach((n, addr) => {
    const l = lookup(chainId, addr);
    if (!l) return;
    if (l.category === 'exchange') {
      flags.push({ type: 'exchange_exposure', wallet: target, score: 0,
        detail: `Funds reached ${l.name} after ${n.hops} hops`,
        plain: `Following the money forward, some of it reached ${l.name} after ${n.hops} hops. Exchanges verify customer identity, so this is a point where investigators can ask who owns the receiving account. It is a useful lead, not a red flag.`,
        evidence: hashes(n.txs), label: l, path: n.path });
    } else if (LABEL_WEIGHTS[l.category] != null) {
      flags.push({ type: 'downstream_exposure', wallet: target, score: Math.round(LABEL_WEIGHTS[l.category] * 0.8),
        detail: `Funds reached ${l.name} (${l.categoryLabel}) after ${n.hops} hops`,
        plain: `Following the money forward, funds from this wallet ended up at "${l.name}", listed as ${l.categoryLabel.toLowerCase()}, after ${n.hops} hops. The hops in between are what make the link indirect, and indirect links are often deliberate.`,
        evidence: hashes(n.txs), label: l, path: n.path });
    }
  });
  return flags;
}

// ─── assembly ────────────────────────────────────────────────────────────────

function buildProfiles(flags) {
  const map = new Map();
  flags.forEach(f => {
    if (!map.has(f.wallet)) map.set(f.wallet, []);
    map.get(f.wallet).push(f);
  });
  return [...map.entries()].map(([wallet, fl]) => {
    const riskScore = noisyOr(fl.map(f => f.score));
    return { wallet, riskScore, severity: severityOf(riskScore),
      flags: fl.map(({ wallet: _w, ...rest }) => rest) };
  }).sort((a, b) => b.riskScore - a.riskScore);
}

function detectAll({ txs, target, chainId, lookup = () => null }) {
  const idx = indexTxs(txs);
  let flags = [
    ...detectSplitting(idx),
    ...detectConsolidation(idx),
    ...detectChaining(idx),
    ...detectPeelChain(idx),
    ...detectLarge(idx),
    ...detectVelocity(idx),
    ...detectRound(idx),
    ...detectDormantBurst(idx, txs),
    ...detectDust(idx, target),
    ...detectLabels(txs, chainId, lookup, target),
    ...detectDownstream(idx, target, chainId, lookup),
  ];

  // 2nd pass: wallets directly touching a high-risk wallet inherit a small bump
  const first = buildProfiles(flags);
  const high = new Set(first.filter(p => p.riskScore >= 70).map(p => p.wallet));
  if (high.size) {
    // Only wallets that *received from* a high-risk wallet are bumped; people who paid into it
    // (e.g. ransomware victims) must not be penalised.
    const touch = new Map();
    txs.forEach(t => {
      if (high.has(t.from) && !high.has(t.to)) touch.set(t.to, [...(touch.get(t.to) || []), t]);
    });
    touch.forEach((list, w) => {
      flags.push({ type: 'neighbour_risk', wallet: w, score: WEIGHTS.neighbour_risk,
        detail: 'Transacted directly with a high-risk wallet',
        plain: 'This wallet received money directly from another wallet that scored high-risk in this investigation. Being nearby is not proof of wrongdoing (it could be an innocent recipient or a service), but it raises the score slightly.',
        evidence: hashes(list) });
    });
  }

  const profiles = buildProfiles(flags);
  const scoreOf = new Map(profiles.map(p => [p.wallet, p]));
  const flatFlags = [];
  flags.forEach(f => {
    const p = scoreOf.get(f.wallet);
    flatFlags.push({ ...f, riskScore: p.riskScore, severity: p.severity,
      title: (PATTERNS[f.type] || {}).title || f.type });
  });
  flatFlags.sort((a, b) => b.riskScore - a.riskScore || b.score - a.score);
  return { flatFlags, profiles };
}

module.exports = { detectAll, PATTERNS, WEIGHTS, bandOf, noisyOr, severityOf, short, fmtUsd };
