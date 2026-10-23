// labels.js — known-address lookup (ransomware, mixers, sanctions, exchanges…)
const fs = require('fs');
const path = require('path');

const CATEGORIES = {
  ransomware:       { label: 'Ransomware-linked',  risk: 90, tone: 'danger'  },
  sanctioned:       { label: 'Sanctioned',         risk: 100, tone: 'danger' },
  sanctioned_mixer: { label: 'Sanctioned mixer',   risk: 100, tone: 'danger' },
  mixer:            { label: 'Mixer',              risk: 70, tone: 'danger'  },
  scam:             { label: 'Reported scam',      risk: 80, tone: 'danger'  },
  darknet:          { label: 'Darknet market',     risk: 70, tone: 'danger'  },
  bridge:           { label: 'Cross-chain bridge', risk: 15, tone: 'caution' },
  exchange:         { label: 'Exchange',           risk: 0,  tone: 'info'    },
  service:          { label: 'Known service',      risk: 0,  tone: 'info'    },
};

let index = null;

function key(chain, address) {
  return `${chain}:${chain === 'evm' || chain === 'ethereum' ? address.toLowerCase() : address}`;
}

function load() {
  if (index) return index;
  index = new Map();
  const file = path.join(__dirname, 'data', 'labels.json');
  let raw = [];
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')).labels || []; } catch { /* no file is fine */ }
  const extra = process.env.EXTRA_LABELS_FILE;
  if (extra) {
    try { raw = raw.concat(JSON.parse(fs.readFileSync(extra, 'utf8')).labels || []); } catch { /* ignore */ }
  }
  raw.forEach(l => {
    if (!l.address || !l.chain) return;
    index.set(key(l.chain, l.address), l);
  });
  return index;
}

const EVM_IDS = new Set(['ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism', 'base']);

function lookup(chainId, address) {
  if (!address) return null;
  const idx = load();
  const fam = EVM_IDS.has(chainId) ? 'evm' : chainId;
  const hit = idx.get(key(fam, address)) || idx.get(key(chainId, address));
  if (!hit) return null;
  const meta = CATEGORIES[hit.category] || { label: hit.category, risk: 0, tone: 'info' };
  return { name: hit.name, category: hit.category, categoryLabel: meta.label, risk: meta.risk, tone: meta.tone, source: hit.source };
}

// ─── Ransomwhere: crowdsourced Bitcoin ransomware payment addresses ──────────
// Downloaded once a day (cached on disk). Disable with RANSOMWHERE=off. The data is third-party and
// crowdsourced, so it is shown as a label with its source, never as proof.
const cacheFile = path.join(__dirname, 'data', 'cache', 'ransomwhere.json');
const rw = { map: new Map(), loaded: 0, at: null, error: null };

function applyRansomwhere(obj) {
  rw.map = new Map(Object.entries(obj.families));
  rw.loaded = rw.map.size;
  rw.at = obj.at;
}

async function syncRansomwhere() {
  if (String(process.env.RANSOMWHERE || '').toLowerCase() === 'off') return;
  try {
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    applyRansomwhere(cached);
    if (Date.now() - cached.at < 24 * 3600e3) return;
  } catch { /* no cache yet */ }
  try {
    const { data } = await require('axios').get('https://api.ransomwhe.re/export', { timeout: 60000, maxContentLength: 60e6 });
    const families = {};
    (data.result || []).forEach(r => { if (r.blockchain === 'bitcoin' && r.address && r.family) families[r.address] = String(r.family).slice(0, 60); });
    if (!Object.keys(families).length) throw new Error('empty export');
    const obj = { at: Date.now(), families };
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(obj));
    applyRansomwhere(obj);
    rw.error = null;
  } catch (err) {
    rw.error = err.message;
    console.error('Ransomwhere sync failed:', err.message);
  }
}

const lookupBase = lookup;
function lookupAll(chainId, address) {
  const hit = lookupBase(chainId, address);
  if (hit || chainId !== 'bitcoin') return hit;
  const fam = rw.map.get(address);
  if (!fam) return null;
  return { name: `${fam} ransomware wallet`, category: 'ransomware', categoryLabel: CATEGORIES.ransomware.label, risk: CATEGORIES.ransomware.risk, tone: 'danger', source: 'Ransomwhere (crowdsourced database)' };
}

const ransomwhereStatus = () => ({ loaded: rw.loaded, updatedAt: rw.at, error: rw.error });

module.exports = { lookup: lookupAll, CATEGORIES, syncRansomwhere, ransomwhereStatus };
