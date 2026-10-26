"use strict";

const express = require("express");
const fairness = require("./fairness");
const { OperatorEngine } = require("./operator");

const app = express();
app.use(express.json({ limit: "256kb" }));

const operator = new OperatorEngine();

app.get("/health", (_req, res) => res.json({ ok: true }));

// Public fairness verifier. A player posts a revealed seed set and gets the
// same outcome the chain produced. This is the trust anchor and needs no auth.
app.post("/verify/dice", (req, res) => {
  const { serverSeed, clientSeed, nonce, target, rollOver } = req.body || {};
  if (!serverSeed || !clientSeed || nonce === undefined || target === undefined) {
    return res.status(400).json({ error: "serverSeed, clientSeed, nonce, target required" });
  }
  try {
    res.json(fairness.settleDice({ serverSeed, clientSeed, nonce, target, rollOver: !!rollOver }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/verify/crash", (req, res) => {
  const { serverSeed, clientSeed, nonce, cashoutBps, houseEdgeBps = 100 } = req.body || {};
  if (!serverSeed || !clientSeed || nonce === undefined || cashoutBps === undefined) {
    return res.status(400).json({ error: "serverSeed, clientSeed, nonce, cashoutBps required" });
  }
  try {
    res.json(fairness.settleCrash({ serverSeed, clientSeed, nonce, cashoutBps, houseEdgeBps }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/verify/commit", (req, res) => {
  const { serverSeed, commit } = req.body || {};
  if (!serverSeed || !commit) return res.status(400).json({ error: "serverSeed, commit required" });
  res.json({ valid: fairness.verifyCommit(serverSeed, commit) });
});

// Game catalogue. In production this reads the on-chain GameRegistry; the
// static shape here is what web and mobile clients consume identically.
app.get("/games", (_req, res) => {
  res.json({
    games: [
      { id: "dice", active: true, houseEdgeBps: 100, maxMultiplierBps: 990000 },
      { id: "crash", active: true, houseEdgeBps: 100, maxMultiplierBps: 1000000 },
    ],
  });
});

// Operator-only endpoints. They exist so the API surface is complete, but the
// engine behind them is the proprietary module (see src/operator.js).
app.post("/operator/settle", async (req, res) => {
  try {
    await operator.settleBet(req.body?.gameId, req.body?.betId);
    res.json({ ok: true });
  } catch (e) {
    res.status(501).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`casino backend on :${PORT}`));
}

module.exports = app;
