"use strict";

// Public provably-fair verifier. This is the exact same math the Solidity
// contracts use, re-implemented so any player can independently replay a result
// from (serverSeed, clientSeed, nonce) once the serverSeed is revealed. Nothing
// here is secret; it is the player's audit tool.

const { keccak256, solidityPacked } = require("ethers");

const E = 2n ** 52n;

function entropy(serverSeed, clientSeed, nonce) {
  return keccak256(
    solidityPacked(["bytes32", "bytes32", "uint256"], [serverSeed, clientSeed, BigInt(nonce)])
  );
}

function verifyCommit(serverSeed, commit) {
  return keccak256(solidityPacked(["bytes32"], [serverSeed])) === commit;
}

// 0..9999 percentile roll.
function diceRoll(serverSeed, clientSeed, nonce) {
  return Number(BigInt(entropy(serverSeed, clientSeed, nonce)) % 10000n);
}

// Crash bust point in basis points (10000 = 1.00x).
function crashPointBps(serverSeed, clientSeed, nonce, houseEdgeBps) {
  const h = BigInt(entropy(serverSeed, clientSeed, nonce)) % E;
  if (h % 10000n < BigInt(houseEdgeBps)) return 10000;
  const point100 = (100n * E - h) / (E - h);
  let bps = point100 * 100n;
  if (bps < 10000n) bps = 10000n;
  const cap = 2n ** 32n - 1n;
  if (bps > cap) bps = cap;
  return Number(bps);
}

// Decide a dice bet exactly as the contract would.
function settleDice({ serverSeed, clientSeed, nonce, target, rollOver }) {
  const roll = diceRoll(serverSeed, clientSeed, nonce);
  const won = rollOver ? roll > target : roll < target;
  return { roll, won };
}

function settleCrash({ serverSeed, clientSeed, nonce, cashoutBps, houseEdgeBps }) {
  const bustBps = crashPointBps(serverSeed, clientSeed, nonce, houseEdgeBps);
  return { bustBps, won: bustBps >= cashoutBps };
}

module.exports = {
  entropy,
  verifyCommit,
  diceRoll,
  crashPointBps,
  settleDice,
  settleCrash,
};
