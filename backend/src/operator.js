"use strict";

/*
 * ─────────────────────────────────────────────────────────────────────────
 *  OPERATOR SETTLEMENT ENGINE — proprietary, NOT included in this repository.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * This file is a deliberate interface-only stub. The production operator engine
 * is the sensitive core of a provably-fair casino and is kept private:
 *
 *   - secure server-seed generation, storage (HSM / KMS) and rotation,
 *   - publishing the keccak256(serverSeed) commit before each seed's first bet,
 *   - driving on-chain settlement without ever exposing an unused seed,
 *   - real-time bankroll exposure and risk limits across all open bets,
 *   - the Moralis/Chainalysis-style AML + sanctions screening wiring that feeds
 *     the on-chain ComplianceRegistry.
 *
 * Everything a *player* needs to trust the house is public: the contracts and
 * the fairness.js verifier. Everything an *operator* needs to run the house
 * safely lives behind this interface, and is delivered as part of an engagement.
 *
 * The methods below throw so the skeleton runs and documents the contract the
 * real engine fulfils, without shipping it.
 */

class OperatorEngine {
  // Returns the current public commit for a game (safe to expose).
  async currentCommit(/* gameId */) {
    throw new Error("operator engine not included: see README (proprietary module)");
  }

  // Generates and commits a fresh server seed for a game.
  async rotateSeed(/* gameId */) {
    throw new Error("operator engine not included: see README (proprietary module)");
  }

  // Settles a placed bet by revealing the seed on-chain under risk controls.
  async settleBet(/* gameId, betId */) {
    throw new Error("operator engine not included: see README (proprietary module)");
  }

  // Pushes a KYC/AML decision to the on-chain ComplianceRegistry.
  async pushComplianceDecision(/* address, allowed */) {
    throw new Error("operator engine not included: see README (proprietary module)");
  }
}

module.exports = { OperatorEngine };
