"use strict";

// Empirical house-edge check. Simulates many provably-fair rounds with the same
// engine the contracts use and reports the realised return-to-player. For a
// correct 1% edge, RTP should sit near 99%. Run: node scripts/montecarlo.js [N]

const { keccak256, toUtf8Bytes } = require("ethers");
const f = require("../src/fairness");

const N = Number(process.argv[2] || 2_000_000);
const HOUSE_EDGE_BPS = 100;

// derive a fresh 32-byte hex seed from a label
function seed(label) {
  return keccak256(toUtf8Bytes(label));
}

function runDice() {
  const server = seed("mc-dice-server");
  const client = seed("mc-dice-client");
  const target = 5000; // 50% chance
  const winCount = target; // under
  const multBps = Math.floor(((10000 - HOUSE_EDGE_BPS) * 10000) / winCount);

  let wagered = 0n;
  let returned = 0n;
  const stake = 100n;
  for (let n = 1; n <= N; n++) {
    wagered += stake;
    const { won } = f.settleDice({ serverSeed: server, clientSeed: client, nonce: n, target, rollOver: false });
    if (won) returned += (stake * BigInt(multBps)) / 10000n;
  }
  return Number((returned * 1000000n) / wagered) / 10000; // RTP %
}

function runCrash() {
  const server = seed("mc-crash-server");
  const client = seed("mc-crash-client");
  const cashoutBps = 20000; // always cash out at 2.00x

  let wagered = 0n;
  let returned = 0n;
  const stake = 100n;
  for (let n = 1; n <= N; n++) {
    wagered += stake;
    const { won } = f.settleCrash({ serverSeed: server, clientSeed: client, nonce: n, cashoutBps, houseEdgeBps: HOUSE_EDGE_BPS });
    if (won) returned += (stake * BigInt(cashoutBps)) / 10000n;
  }
  return Number((returned * 1000000n) / wagered) / 10000;
}

console.log(`rounds per game: ${N.toLocaleString()}  (house edge ${HOUSE_EDGE_BPS / 100}%)`);
const diceRtp = runDice();
console.log(`dice  RTP: ${diceRtp.toFixed(3)}%   (target ~99.000%)`);
const crashRtp = runCrash();
console.log(`crash RTP: ${crashRtp.toFixed(3)}%   (target ~99.000%)`);
