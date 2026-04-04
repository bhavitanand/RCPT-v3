// detection.js — upgraded detection engine with weighted risk scoring

const WEIGHTS = {
  splitting_moderate: 25,   // 3–5 unique receivers in 24h
  splitting_severe:   40,   // 6+ unique receivers in 24h
  chaining_rapid:     35,   // funds forwarded within 1 hour of receipt
  chaining_normal:    15,   // funds forwarded but not rapid
  large_medium:       20,   // > 1 ETH
  large_high:         35,   // > 5 ETH
  velocity:           25,   // > 5 txns in any 1-hour window
  round_amount:       10,   // suspiciously round ETH values
};

const ONE_HOUR_MS  = 60 * 60 * 1000;
const ONE_DAY_MS   = 24 * ONE_HOUR_MS;
const ROUND_VALUES = new Set([0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100]);

// ─── helpers ────────────────────────────────────────────────────────────────

function toMs(timestamp) {
  if (timestamp instanceof Date) return timestamp.getTime();
  if (typeof timestamp === 'number') return timestamp * 1000;
  return new Date(timestamp).getTime();
}

function isRound(amount) {
  return ROUND_VALUES.has(amount) || (amount > 0 && amount % 1 === 0 && amount <= 100);
}

// ─── 1. Time-windowed splitting ──────────────────────────────────────────────
function detectSplitting(transactions) {
  // For each sender, group receivers by 24-hour windows
  const senderWindows = {};

  transactions.forEach(tx => {
    const sender = tx.sender.toLowerCase();
    const ts     = toMs(tx.timestamp);

    if (!senderWindows[sender]) senderWindows[sender] = [];
    senderWindows[sender].push({ receiver: tx.receiver.toLowerCase(), ts });
  });

  const scores = {};

  for (const [sender, entries] of Object.entries(senderWindows)) {
    // Slide a 24-hour window over sorted timestamps
    const sorted = entries.sort((a, b) => a.ts - b.ts);
    let maxUnique = 0;

    for (let i = 0; i < sorted.length; i++) {
      const windowEnd   = sorted[i].ts + ONE_DAY_MS;
      const windowTxs   = sorted.filter(e => e.ts >= sorted[i].ts && e.ts <= windowEnd);
      const uniqueCount = new Set(windowTxs.map(e => e.receiver)).size;
      if (uniqueCount > maxUnique) maxUnique = uniqueCount;
    }

    if (maxUnique >= 3) {
      const weight = maxUnique >= 6 ? WEIGHTS.splitting_severe : WEIGHTS.splitting_moderate;
      scores[sender] = (scores[sender] || 0) + weight;
    }
  }

  return Object.entries(scores).map(([wallet, score]) => ({
    type:    'splitting',
    wallet,
    score,
    detail: `Funds split to multiple unique receivers within 24h`,
  }));
}

// ─── 2. Rapid chaining ──────────────────────────────────────────────────────
function detectChaining(transactions) {
  // Build receipt times: when did each wallet receive funds?
  const receiptTimes = {};

  transactions.forEach(tx => {
    const receiver = tx.receiver.toLowerCase();
    const ts       = toMs(tx.timestamp);
    if (!receiptTimes[receiver]) receiptTimes[receiver] = [];
    receiptTimes[receiver].push(ts);
  });

  const scores = {};

  transactions.forEach(tx => {
    const sender = tx.sender.toLowerCase();
    const ts     = toMs(tx.timestamp);

    if (receiptTimes[sender]) {
      // Did this sender receive funds shortly before sending?
      const rapidReceipt = receiptTimes[sender].some(
        receiptTs => ts - receiptTs >= 0 && ts - receiptTs <= ONE_HOUR_MS
      );

      const weight = rapidReceipt ? WEIGHTS.chaining_rapid : WEIGHTS.chaining_normal;
      scores[sender] = (scores[sender] || 0) + weight;
    }
  });

  return Object.entries(scores).map(([wallet, score]) => ({
    type:   'chaining',
    wallet,
    score,
    detail: score >= WEIGHTS.chaining_rapid
      ? 'Funds forwarded within 1 hour of receipt (rapid hop)'
      : 'Wallet both receives and forwards funds',
  }));
}

// ─── 3. Large transactions ───────────────────────────────────────────────────
function detectLarge(transactions) {
  const scores = {};
  const amounts = {};

  transactions.forEach(tx => {
    if (tx.amount > 1) {
      const sender = tx.sender.toLowerCase();
      const weight = tx.amount > 5 ? WEIGHTS.large_high : WEIGHTS.large_medium;
      scores[sender]  = (scores[sender]  || 0) + weight;
      amounts[sender] = Math.max(amounts[sender] || 0, tx.amount);
    }
  });

  return Object.entries(scores).map(([wallet, score]) => ({
    type:   'large',
    wallet,
    score,
    amount: amounts[wallet],
    detail: `High-value transaction(s) detected (max: ${amounts[wallet].toFixed(4)} ETH)`,
  }));
}

// ─── 4. Velocity detection ───────────────────────────────────────────────────
function detectVelocity(transactions) {
  const senderTxs = {};

  transactions.forEach(tx => {
    const sender = tx.sender.toLowerCase();
    if (!senderTxs[sender]) senderTxs[sender] = [];
    senderTxs[sender].push(toMs(tx.timestamp));
  });

  const scores = {};

  for (const [sender, times] of Object.entries(senderTxs)) {
    const sorted = times.sort((a, b) => a - b);
    let maxInWindow = 0;

    for (let i = 0; i < sorted.length; i++) {
      const windowEnd = sorted[i] + ONE_HOUR_MS;
      const count     = sorted.filter(t => t >= sorted[i] && t <= windowEnd).length;
      if (count > maxInWindow) maxInWindow = count;
    }

    if (maxInWindow > 5) {
      scores[sender] = WEIGHTS.velocity;
    }
  }

  return Object.entries(scores).map(([wallet, score]) => ({
    type:   'velocity',
    wallet,
    score,
    detail: 'Unusually high transaction frequency within a 1-hour window',
  }));
}

// ─── 5. Round amount detection ───────────────────────────────────────────────
function detectRoundAmounts(transactions) {
  const scores = {};

  transactions.forEach(tx => {
    if (isRound(tx.amount)) {
      const sender = tx.sender.toLowerCase();
      scores[sender] = (scores[sender] || 0) + WEIGHTS.round_amount;
    }
  });

  return Object.entries(scores).map(([wallet, score]) => ({
    type:   'round_amount',
    wallet,
    score,
    detail: 'Transactions use suspiciously round ETH values',
  }));
}

// ─── 6. Merge + deduplicate into per-wallet risk profiles ────────────────────
function buildRiskProfiles(allFlags) {
  const walletMap = {};

  allFlags.forEach(flag => {
    const w = flag.wallet;
    if (!walletMap[w]) {
      walletMap[w] = { wallet: w, totalScore: 0, flags: [] };
    }
    walletMap[w].totalScore += flag.score;
    walletMap[w].flags.push({
      type:   flag.type,
      score:  flag.score,
      detail: flag.detail,
      ...(flag.amount !== undefined && { amount: flag.amount }),
    });
  });

  // Cap total score at 100 and assign severity
  return Object.values(walletMap).map(profile => {
    const capped = Math.min(profile.totalScore, 100);
    const severity =
      capped >= 70 ? 'HIGH' :
      capped >= 40 ? 'MEDIUM' : 'LOW';

    return {
      wallet:     profile.wallet,
      riskScore:  capped,
      severity,
      flags:      profile.flags,
    };
  });
}

// ─── Main export ─────────────────────────────────────────────────────────────
function detectAll(transactions) {
  const allFlags = [
    ...detectSplitting(transactions),
    ...detectChaining(transactions),
    ...detectLarge(transactions),
    ...detectVelocity(transactions),
    ...detectRoundAmounts(transactions),
  ];

  const profiles = buildRiskProfiles(allFlags);

  // Flatten back to the flag array the rest of the app expects,
  // but now each flag carries riskScore + severity from its parent profile
  const flatFlags = [];

  profiles.forEach(profile => {
    profile.flags.forEach(flag => {
      flatFlags.push({
        type:      flag.type,
        wallet:    profile.wallet,
        riskScore: profile.riskScore,
        severity:  profile.severity,
        detail:    flag.detail,
        ...(flag.amount !== undefined && { amount: flag.amount }),
      });
    });
  });

  return { flatFlags, profiles };
}

module.exports = detectAll;
