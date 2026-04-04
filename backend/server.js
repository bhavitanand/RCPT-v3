const express = require("express");
const axios   = require("axios");
const cors    = require("cors");
require("dotenv").config();

const detectAll = require("./detection");

const app = express();
app.use(cors({ origin: "*" }));

const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => res.send("Server is running"));

// ─── helper: build graph from tx list ────────────────────────────────────────
function buildGraph(txList) {
  const nodesSet = new Set();
  const edges    = [];

  txList.forEach(tx => {
    nodesSet.add(tx.from || tx.sender);
    nodesSet.add(tx.to   || tx.receiver);
    edges.push({
      source: tx.from || tx.sender,
      target: tx.to   || tx.receiver,
      amount: tx.amount,
    });
  });

  return { nodes: Array.from(nodesSet).map(id => ({ id })), edges };
}

// ─── helper: build stats ──────────────────────────────────────────────────────
function buildStats(txList, address) {
  let totalSent = 0, totalReceived = 0;
  const addr = address.toLowerCase();

  txList.forEach(tx => {
    const from = (tx.from || tx.sender || "").toLowerCase();
    const to   = (tx.to   || tx.receiver || "").toLowerCase();
    if (from === addr) totalSent     += tx.amount;
    if (to   === addr) totalReceived += tx.amount;
  });

  return { totalSent, totalReceived, txCount: txList.length };
}

// ─── /wallet/:address ────────────────────────────────────────────────────────
app.get("/wallet/:address", async (req, res) => {
  const address = req.params.address;

  try {
    const response = await axios.get("https://api.etherscan.io/v2/api", {
      params: {
        module:     "account",
        action:     "txlist",
        address,
        startblock: 0,
        endblock:   99999999,
        sort:       "desc",
        chainid:    "1",
        apikey:     process.env.ETHERSCAN_API_KEY,
      },
    });

    if (response.data.status !== "1") throw new Error("Etherscan API error");

    const raw = response.data.result;
    if (!raw || raw.length === 0) throw new Error("No transactions found");

    // Clean + normalise
    const cleanedTx = raw
      .slice(0, 50)
      .map(tx => ({
        hash:      tx.hash,
        from:      tx.from,
        to:        tx.to,
        amount:    Number(tx.value) / 1e18,
        timestamp: new Date(tx.timeStamp * 1000),
      }))
      .filter(tx => tx.amount > 0.00001);

    // Detection expects { sender, receiver, amount, timestamp }
    const detectionInput = cleanedTx.map(tx => ({
      sender:    tx.from,
      receiver:  tx.to,
      amount:    tx.amount,
      timestamp: tx.timestamp,
    }));

    const { flatFlags, profiles } = detectAll(detectionInput);

    res.json({
      stats:        buildStats(cleanedTx, address),
      graph:        buildGraph(cleanedTx),
      transactions: cleanedTx,
      flags:        flatFlags,
      profiles,
    });

  } catch (error) {
    console.error("Live fetch failed, using demo data:", error.message);
    await new Promise(resolve => setTimeout(resolve, 1500));

    const demo = require("./demoData.json");

    const { flatFlags, profiles } = detectAll(demo.transactions);

    // Normalise demo tx shape to match frontend (from/to instead of sender/receiver)
    const normalisedTx = demo.transactions.map(tx => ({
      hash:      tx.hash || `demo-${Math.random().toString(36).slice(2)}`,
      from:      tx.sender,
      to:        tx.receiver,
      amount:    tx.amount,
      timestamp: new Date(tx.timestamp * 1000),
    }));

    // Demo stats: count all sent/received (no single "address" to filter by)
    let totalSent = 0, totalReceived = 0;
    demo.transactions.forEach(tx => {
      totalSent     += tx.amount;
      totalReceived += tx.amount;
    });

    res.json({
      stats: {
        totalSent,
        totalReceived,
        txCount: normalisedTx.length,
      },
      graph:        buildGraph(normalisedTx),
      transactions: normalisedTx,
      flags:        flatFlags,
      profiles,
    });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
