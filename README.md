# Ransomware Crypto Payments Tracker

### Blockchain Forensics & Transaction Analysis Dashboard

---

## Overview

The **Ransomware Crypto Payment Tracker** is a blockchain forensics tool designed to analyze cryptocurrency wallet activity and identify suspicious transaction patterns commonly associated with ransomware operations and financial crime.

It transforms raw blockchain data into an **interactive investigation dashboard**, enabling analysts to:

- Track fund movements across wallets
- Visualize transaction networks as interactive graphs
- Detect and score suspicious financial behavior
- Understand potential laundering and obfuscation patterns

---

## Problem Statement

Ransomware attackers increasingly demand cryptocurrency payments due to:

- Pseudonymous wallet identities
- Complex fund movement across multiple addresses
- Lack of accessible, affordable tooling for tracing and interpretation

Enterprise solutions like Chainalysis cost tens of thousands of dollars annually, putting them out of reach for small security teams, independent analysts, and growing companies. This project bridges that gap.

---

## Solution

A simplified but capable blockchain forensics platform combining:

- Real-time wallet data retrieval via public APIs
- Graph-based transaction visualization
- Weighted, rule-based anomaly detection engine
- Per-wallet risk scoring (0–100)
- Structured investigation workflows accessible without specialist training

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript, TailwindCSS, Cytoscape.js, Axios |
| Backend | Node.js, Express.js |
| Data Source | Etherscan API (V2) |

---

## Key Features

### Wallet Analysis
- Fetches live transaction data from the Ethereum blockchain
- Calculates total sent, total received, and transaction count per wallet

---

### Weighted Risk Scoring System

Each wallet is assigned a **risk score from 0 to 100** built from weighted pattern signals rather than simple flag counts. Scores map to:

| Score | Level |
|---|---|
| 0–39 | Low Risk |
| 40–69 | Medium Risk |
| 70–100 | High Risk |

The score is aggregated per wallet across all detected patterns and capped at 100, giving a single comparable number per address.

---

### Detection Engine

Five detection modules run in parallel on every analysis:

#### Splitting — Time-Windowed
Detects wallets distributing funds to multiple unique receivers within a **24-hour sliding window**.
- 3–5 unique receivers → +25 pts
- 6+ unique receivers → +40 pts

#### Chaining — Rapid Hop Detection
Detects wallets that forward received funds onward, with extra weight for speed.
- Funds forwarded within **1 hour** of receipt → +35 pts (rapid layering)
- Funds forwarded outside 1 hour → +15 pts (general chaining)

#### Large Transfers
Flags high-value outflows relative to common thresholds.
- > 1 ETH → +20 pts
- > 5 ETH → +35 pts

#### Velocity Detection
Flags wallets with unusually high transaction frequency.
- More than **5 transactions in any 1-hour window** → +25 pts

#### Round Amount Detection
Flags suspiciously round ETH values — a known structuring and layering signal.
- Transactions matching round values (0.1, 0.5, 1, 2, 5, 10... ETH) → +10 pts each

---

### Per-Wallet Risk Profiles
Every flagged address gets its own consolidated profile showing:
- Aggregate risk score with a visual progress bar
- All pattern types detected as chips
- HIGH / MEDIUM / LOW severity classification

---

### Investigation Insights
Automatically generated plain-language summaries describing:
- Fund distribution patterns
- Possible layering or obfuscation behaviour
- Indicators of ransomware cash-out activity

---

### Transaction Graph Visualization
- Interactive network graph powered by Cytoscape.js
- Color-coded nodes: target wallet, suspicious wallets, normal wallets
- Edge thickness proportional to transaction value
- Pan, zoom, and click interactions

---

### Transaction Explorer
- Full transaction history for any searched wallet
- Color-coded by direction (incoming / outgoing)
- Timestamped with copy-to-clipboard and Etherscan deep-link per transaction

---

### Timeline View
- Chronological event log combining transactions and detection flags
- Severity badges on flagged events
- Filters out noise — only surfaces significant activity

---

### Offline Fallback Mode
- Falls back to a preloaded demo dataset when the Etherscan API is unavailable
- Ensures uninterrupted demos and local testing

---

## How It Works

```
User enters wallet address
        ↓
Backend fetches transactions from Etherscan API
        ↓
Transactions are cleaned and normalised
        ↓
Detection engine runs 5 parallel pattern modules
        ↓
Per-wallet risk profiles are built with weighted scores
        ↓
Frontend renders: risk ring, alerts, graph, timeline
```

---

## Setup Instructions

### 1. Clone Repository

```bash
git clone https://github.com/your-username/crypto-tracker.git
cd crypto-tracker
```

### 2. Backend Setup

```bash
npm install
```

Create a `.env` file in the root directory:

```env
ETHERSCAN_API_KEY=your_api_key_here
```

> Get a free key at [etherscan.io/apis](https://etherscan.io/apis) — no credit card required.

Start the server:

```bash
node server.js
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Security Note

Never commit your `.env` file. Ensure it is listed in `.gitignore`. When deploying, set `ETHERSCAN_API_KEY` as an environment variable directly on your hosting platform (Render, Railway, etc.).

---

## Cybersecurity Relevance

This project demonstrates how blockchain transparency can be operationalised to:

- Trace ransomware payment flows
- Identify fund obfuscation techniques (splitting, chaining, structuring)
- Support threat intelligence and incident response workflows
- Provide accessible forensic capability without enterprise tooling costs

---

## Future Roadmap

- **Multi-chain support** — Bitcoin, Solana, Tron
- **ML-based anomaly detection** — replace rule weights with trained classifiers
- **Real-time monitoring** — webhook alerts on new suspicious transactions
- **Wallet clustering** — heuristic-based address attribution
- **Exportable reports** — PDF/CSV investigation summaries

---

## Disclaimer

This project is intended for **educational and research purposes only**. It performs read-only analysis of publicly available blockchain data and does not guarantee investigative accuracy. It should not be used as the sole basis for legal or financial decisions.

---

## Acknowledgements

- [Etherscan API](https://etherscan.io/apis)
- [Cytoscape.js](https://js.cytoscape.org/)
- [Lucide Icons](https://lucide.dev/)
- Open-source community