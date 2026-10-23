# RCPT v3: Ransomware Crypto Payment Tracker

**Follow the money, in plain English.** Paste a wallet from Ethereum (and other EVM chains), Bitcoin, Solana or Tron. RCPT shows where the money came from and where it went, flags laundering patterns with proof, and explains the result so a non-expert can follow it.

## What's new in v3

| Area | v2 | v3 |
|---|---|---|
| Look and feel | Dark dashboard | Light, ETAP-style experience: guided report, animated explainer, hover glossary, Learn page |
| Networks | Ethereum only | Ethereum, BNB Chain, Polygon, Arbitrum, Optimism, Base, **Bitcoin, Solana, Tron** (incl. USDT-TRC20 and ERC-20 tokens) |
| Explanations | Hard-coded sentences | **Gemini** writes a story, meaning and next steps (Simple or Analyst); offline explainer when no key; grounded follow-up chat |
| Detection | 5 rules summed | 14 signals combined with noisy-OR, each with plain text and **tx-hash evidence**; watchlist labels; downstream tracing; peel chains |
| Failure mode | Silently fell back to demo data | Honest errors; demos are explicit, labelled **simulated** |
| Investigation | One wallet | Optional "follow the trail deeper", cross-network scan, replay slider, saved cases, CSV/JSON/PDF export |

### Added since v3.0 (informed by what investigators and victims say is missing)

Research note: the forum search returned mostly vendor and aggregator pages, not Reddit threads, so these are inferred gaps, not quoted demand. Recurring themes: victims start with a receipt or ransom note, fake "recovery agents" prey on them, traces die at bridges, courts want exportable evidence with provenance, and free tiers keep shrinking (Arkham moved custom labels behind a paywall).

- **Start from anything:** paste a wallet, a **transaction hash** (shows who paid whom, then pick a wallet), or a whole **ransom note** (addresses and hashes are extracted).
- **Ransomwhere integration:** about 11,000 crowdsourced Bitcoin ransomware addresses with family names, synced daily (disable with `RANSOMWHERE=off`; I could not confirm its license terms, so check them before commercial use).
- **Wallet linking (Bitcoin):** wallets that co-sign a transaction are surfaced as "probably the same owner" (CoinJoin-like transactions excluded).
- **Evidence pack:** a self-contained HTML report with findings, proof hashes, label provenance, analyst note, method statement and a SHA-256 integrity hash.
- **My labels:** private, browser-local wallet labels shown in the map, tables and evidence pack.
- **Batch check:** triage up to 10 wallets from any network, riskiest first, with CSV export.
- **Case re-checks:** re-check all saved cases and see score changes and new-transaction counts.
- **Languages:** Gemini explains in Hindi, Spanish, French, German, Portuguese, Arabic, Chinese and Japanese (built-in explainer is English only).
- **Scam awareness:** recovery-scam warning on risky reports; FAQ on bridges, receipts and recovery.
- **Cross-network scan:** active networks for an EVM address are one-click traces.

## Quick start

```bash
# API
cd backend
cp .env.example .env      # add ETHERSCAN_API_KEY (and GEMINI_API_KEY if you want Gemini)
npm install
npm start                 # http://localhost:5000

# Web (second terminal)
cd frontend
npm install
npm run dev               # http://localhost:5173  (proxies /api to :5000)
```

Bitcoin, Solana, Tron and the simulated demos need **no key**. Open `http://localhost:5173` and try a demo.

Tests: `cd backend && npm test`. Frontend: `npm run build` (type-checks then builds) and `npm run lint`. Verify Gemini with `cd backend && npm run check:gemini`.

## Deploying (Render API + Vercel web)

**API on Render** (Web Service): Root Directory `backend`, Build Command `npm install`, Start Command `npm start`. Environment variables: `ETHERSCAN_API_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `ALLOWED_ORIGINS` (your Vercel URL, for example `https://rcpt.vercel.app`, no trailing slash; comma-separate several), optionally `SOLANA_RPC_URL` and `TRONGRID_API_KEY`. Render's free tier sleeps, so the first request after a pause is slow. Check `/api/health` on the deployed URL.

**Web on Vercel**: Root Directory `frontend`, framework Vite, Build Command `npm run build`, Output `dist`. Environment variable `VITE_API_URL` = your Render URL (no trailing slash). Routing uses `#/` URLs, so no rewrites are needed.

**Never commit** `backend/.env` (real keys), `node_modules/`, `dist/` or `backend/data/cache/`. The root `.gitignore` covers them. If you copy files by hand into a repo folder (for example for GitHub Desktop), copy everything except those four.

## Architecture

```
backend/
  server.js        Express API, rate limits, in-memory analysis store (AI endpoints only see what we computed)
  chains.js        network registry + address detection (base58check disambiguates BTC / Tron / Solana)
  providers/       evm (Etherscan V2), bitcoin (mempool.space), solana (JSON-RPC), tron (TronGrid)
  analysis.js      fetch -> normalise -> price -> label -> detect -> summarise (+ optional depth-2 expansion)
  detection.js     chain-agnostic engine; PATTERNS carries plain-English "why it matters" text
  labels.js, data/labels.json   watchlist (extend via EXTRA_LABELS_FILE)
  gemini.js        digest -> structured JSON explanation, chat, offline fallbacks, prompt-injection hygiene
  demo.js          seeded SIMULATED scenarios
frontend/ (React + TypeScript + Vite, plain CSS)
  pages: Home, Report (Summary / Money map / Activity / Where it went / Why flagged), Cases, Learn, Status
```

### API

`GET /api/health` · `GET /api/demos` · `GET /api/detect?address=` · `GET /api/analyze?address=&chain=auto&depth=1|2` or `?demo=ransomware|peel|ordinary` · `GET /api/scan?address=` (EVM activity per network) · `POST /api/explain {id, audience}` · `POST /api/chat {id, question, history}`

### Detection signals

Fan-out splitting, fan-in consolidation, rapid hopping, peel chains, large transfers (USD), bursts, round amounts, dormant-then-active, dusting, watchlisted/mixer/sanctioned contact, **downstream exposure** (funds reach a watchlisted address within 6 hops), exchange cash-out leads (informational, 0 points), and neighbour risk. Scores combine as `1 - Π(1 - s/100)`, so weak signals add up but a strong one (a ransomware label) dominates.

## Honest limitations

- Heuristics, not proof. A score shows patterns that often appear in laundering; it cannot identify an owner.
- Only recent transactions are read (reports say when history was cut). Solana covers native SOL only for now; Bitcoin is flattened from UTXOs into payments relative to the searched address.
- Dollar values use the **current** price, not the price on the day of each transaction, so old large payments can look different from their historical value.
- Not built (need accounts or paid infrastructure): live push alerts/webhooks, automatic bridge-crossing matching, ML clustering. Cases and labels are browser-local.
- The bundled watchlist is a small starter set. Add your own intel via `EXTRA_LABELS_FILE`.
- Etherscan's free plan covers Ethereum and Polygon but not BNB Chain, Base or Optimism (the app says so). The free plan allows about 3 calls per second; the server queues and retries to stay inside it, so EVM reports take 1 to 3 seconds and batch checks are slower.
- Solana uses the public RPC by default, which rate-limits; busy wallets can take 10 to 25 seconds and may show a "some transactions could not be read" notice. Set `SOLANA_RPC_URL` to a dedicated endpoint for speed.
- No authentication yet, by design for this stage.

## Disclaimer

For education and research. RCPT performs read-only analysis of public blockchain data and should not be the sole basis for legal or financial decisions.
