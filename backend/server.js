const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
require('dotenv').config({ path: require('path').join(__dirname, '.env') }); // works from any working directory

const { CHAINS, resolveChain, detectChains } = require('./chains');
const providers = require('./providers');
const { analyzeLive, analyzeDemo } = require('./analysis');
const { SCENARIOS } = require('./demo');
const { PATTERNS } = require('./detection');
const gemini = require('./gemini');
const labels = require('./labels');
const { extract } = require('./extract');
const { lookupTx } = require('./providers/txlookup');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '50kb' }));

// CORS: comma-separated ALLOWED_ORIGINS; open only when unset (local development)
const origins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true }));
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests. Please wait a minute.' } }));
const aiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many AI requests. Please wait a minute.' } });

// Recent analyses live in memory so the AI endpoints work on what *we* computed, never on client-supplied data
const store = new Map();
const TTL = 60 * 60 * 1000;
function remember(analysis) {
  const id = crypto.randomBytes(8).toString('hex');
  store.set(id, { at: Date.now(), analysis });
  if (store.size > 200) {
    const now = Date.now();
    for (const [k, v] of store) if (now - v.at > TTL) store.delete(k);
    while (store.size > 200) store.delete(store.keys().next().value);
  }
  return id;
}
function recall(id) {
  const hit = store.get(String(id));
  return hit && Date.now() - hit.at < TTL ? hit.analysis : null;
}

const wrap = fn => (req, res) => fn(req, res).catch(err => {
  const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status >= 500) console.error(err.message);
  res.status(status).json({ error: err.message || 'Something went wrong.' });
});

app.get('/', (_req, res) => res.send('RCPT v3 API is running'));

app.get('/api/health', (_req, res) => {
  const avail = providers.availability();
  res.json({
    ok: true, version: '3.0.0',
    gemini: gemini.enabled(), geminiModel: gemini.enabled() ? gemini.MODEL() : null,
    families: avail, ransomwhere: labels.ransomwhereStatus(),
    chains: Object.values(CHAINS).map(c => ({ id: c.id, name: c.name, symbol: c.symbol, family: c.family, ready: avail[c.family] })),
  });
});

app.get('/api/patterns', (_req, res) => res.json({ patterns: PATTERNS, glossary: gemini.GLOSSARY }));

app.get('/api/demos', (_req, res) => res.json({
  demos: Object.values(SCENARIOS).map(s => ({ id: s.id, title: s.title, blurb: s.blurb, chain: CHAINS[s.chain].name })),
}));

app.get('/api/detect', (req, res) => {
  const address = String(req.query.address || '').trim();
  const ids = detectChains(address);
  res.json({ valid: ids.length > 0, chains: ids.map(i => ({ id: i, name: CHAINS[i].name })) });
});

app.get('/api/analyze', wrap(async (req, res) => {
  const demoId = req.query.demo && String(req.query.demo);
  let analysis;
  if (demoId) {
    analysis = analyzeDemo(demoId);
  } else {
    const r = resolveChain(req.query.address, req.query.chain);
    if (r.error) return res.status(400).json({ error: r.error });
    const depth = Number(req.query.depth) >= 2 ? 2 : 1;
    analysis = await analyzeLive(r.chain, r.address, { depth });
    analysis.meta.otherNetworks = r.candidates.filter(c => c !== r.chain.id && CHAINS[c].family === 'evm').length ? 'evm' : null;
  }
  res.json({ id: remember(analysis), ...analysis });
}));

// Which EVM networks has this address been active on? (bridging across chains is a laundering step)
app.get('/api/scan', wrap(async (req, res) => {
  const address = String(req.query.address || '').trim();
  const evmChains = Object.values(CHAINS).filter(c => c.family === 'evm');
  if (!detectChains(address).some(id => CHAINS[id].family === 'evm')) return res.status(400).json({ error: 'Cross-network scan needs an EVM (0x…) address.' });
  const out = [];
  for (const c of evmChains) { // sequential: stays inside the free-plan rate limit
    try { out.push({ id: c.id, name: c.name, ...(await providers.evm.hasActivity(c, address)) }); }
    catch (err) { out.push({ id: c.id, name: c.name, active: null, error: err.message }); }
  }
  res.json({ address, networks: out });
}));

// Paste a ransom note, email or chat: we pull out wallet addresses and transaction hashes
app.post('/api/extract', wrap(async (req, res) => {
  res.json(extract(req.body && req.body.text));
}));

// Start from a transaction hash (a receipt) instead of a wallet
app.get('/api/tx', wrap(async (req, res) => {
  res.json(await lookupTx(String(req.query.hash || '').trim()));
}));

// Triage a list of addresses (for example IOCs from an incident) with a one-line result each
const batchLimiter = rateLimit({ windowMs: 60 * 1000, limit: 4, standardHeaders: true, legacyHeaders: false, message: { error: 'Batch checks are limited to a few per minute.' } });
app.post('/api/batch', batchLimiter, wrap(async (req, res) => {
  const list = [...new Set((Array.isArray(req.body && req.body.addresses) ? req.body.addresses : []).map(a => String(a).trim()).filter(Boolean))].slice(0, 10);
  if (!list.length) return res.status(400).json({ error: 'Send up to 10 addresses.' });
  const rows = [];
  for (const address of list) {
    const r = resolveChain(address, 'auto');
    if (r.error) { rows.push({ address, error: r.error }); continue; }
    try {
      const a = await analyzeLive(r.chain, r.address, { depth: 1 });
      const top = a.flags.filter(f => f.wallet === a.meta.address && f.score > 0).slice(0, 3).map(f => f.title);
      rows.push({ address, chain: a.meta.chain, chainName: a.meta.chainName, score: a.verdict.score, band: a.verdict.band, label: a.verdict.label, txCount: a.stats.txCount, receivedUsd: a.stats.totalReceivedUsd, top });
    } catch (err) { rows.push({ address, chain: r.chain.id, chainName: r.chain.name, error: err.message }); }
  }
  res.json({ rows });
}));

app.post('/api/explain', aiLimiter, wrap(async (req, res) => {
  const a = recall(req.body && req.body.id);
  if (!a) return res.status(404).json({ error: 'That analysis expired. Run the check again.' });
  const audience = req.body.audience === 'analyst' ? 'analyst' : 'simple';
  res.json(await gemini.explain(a, { audience, language: req.body.language }));
}));

app.post('/api/chat', aiLimiter, wrap(async (req, res) => {
  const a = recall(req.body && req.body.id);
  if (!a) return res.status(404).json({ error: 'That analysis expired. Run the check again.' });
  res.json(await gemini.chat(a, req.body.question, req.body.history));
}));

// Always answer with JSON, including for malformed request bodies and unknown routes
app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API route.' }));
app.use((err, _req, res, _next) => {
  const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
  res.status(status).json({ error: status === 400 || err.type === 'entity.parse.failed' ? 'That request could not be read.' : 'Something went wrong.' });
});

if (require.main === module) {
  labels.syncRansomwhere();
  setInterval(() => labels.syncRansomwhere(), 24 * 3600e3).unref();
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`RCPT v3 API on port ${PORT} (Gemini ${gemini.enabled() ? 'on' : 'off'}, Etherscan ${process.env.ETHERSCAN_API_KEY ? 'on' : 'off'})`));
}

module.exports = app;
