"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const { encodeBytes32String, keccak256 } = require("ethers");
const f = require("../src/fairness");

// Fixed vectors. These are the exact values the Solidity test asserts against,
// so if the contract math or fairness.js drifts, one side fails.
const SS = encodeBytes32String("server-seed-001");
const CS = encodeBytes32String("client-seed-xyz");
const COMMIT = keccak256(SS);

test("commit verification", () => {
  assert.strictEqual(f.verifyCommit(SS, COMMIT), true);
  assert.strictEqual(f.verifyCommit(encodeBytes32String("other"), COMMIT), false);
});

test("dice roll vector (nonce 1) == 1874", () => {
  assert.strictEqual(f.diceRoll(SS, CS, 1), 1874);
});

test("dice settle: under 5000 wins at roll 1874", () => {
  const r = f.settleDice({ serverSeed: SS, clientSeed: CS, nonce: 1, target: 5000, rollOver: false });
  assert.deepStrictEqual(r, { roll: 1874, won: true });
});

test("dice settle: over 5000 loses at roll 1874", () => {
  const r = f.settleDice({ serverSeed: SS, clientSeed: CS, nonce: 1, target: 5000, rollOver: true });
  assert.strictEqual(r.won, false);
});

test("crash bust vector (nonce 1, edge 100) == 22700 bps", () => {
  assert.strictEqual(f.crashPointBps(SS, CS, 1, 100), 22700);
});

test("crash settle: cashout 2.00x wins at 2.27x bust", () => {
  const r = f.settleCrash({ serverSeed: SS, clientSeed: CS, nonce: 1, cashoutBps: 20000, houseEdgeBps: 100 });
  assert.strictEqual(r.won, true);
  assert.strictEqual(r.bustBps, 22700);
});

test("crash settle: cashout above bust loses", () => {
  const r = f.settleCrash({ serverSeed: SS, clientSeed: CS, nonce: 1, cashoutBps: 30000, houseEdgeBps: 100 });
  assert.strictEqual(r.won, false);
});

test("instant-bust slice returns 1.00x floor", () => {
  // scan nonces until we hit an instant bust; confirm it is exactly 10000 bps
  let found = false;
  for (let n = 1; n < 2000 && !found; n++) {
    if (f.crashPointBps(SS, CS, n, 100) === 10000) found = true;
  }
  assert.strictEqual(found, true);
});
