![ProofRoll — provably-fair crypto casino](assets/cover.png)

# ProofRoll — Crypto Casino

**Live demo:** https://charlie-hk.github.io/ProofRoll-Crypto-Casino/ — plays dice and
crash and runs the real provably-fair engine in your browser (no funds, no backend).

A provably-fair casino built on an extensible on-chain core: a commit-reveal
fairness engine, custody with per-bet exposure locking, a KYC/compliance gate,
and a game registry that new games plug into without touching the core. Two
games ship as the reference implementation — **dice** and **crash** — the two
most popular crypto-native originals.

This repository is **testnet-only** and ships with its compliance layer built
in. It is engineered so a licensed operator could run it, but running a casino
is a regulated activity: see **Legal** below.

```
                    place bet (+ wager)                 settle (reveal seed)
  player ───────────────────────────────► Game ◄─────────────────────────── operator
    ▲  KYC-gated                            │                                   │
    │                                       ▼                                   ▼
    │                                   Bankroll (custody, locks worst-case payout)
    │                                       ▲
  verify result  ◄── fairness.js / contracts ┘   (anyone can replay every outcome)
```

## Why it is built this way

- **Provably fair by construction.** The operator commits `keccak256(serverSeed)`
  before a seed's first bet. Each outcome is a pure function of
  `(serverSeed, clientSeed, nonce)`. Once the seed is revealed at settlement,
  anyone replays every result — on-chain or with the public `fairness.js`
  verifier. The house cannot pick outcomes after the fact.
- **Custody that can't over-promise.** Every open bet locks its worst-case
  payout in the `Bankroll`. The house can never accept a bet it couldn't pay.
  Each game also has its own exposure cap, so one game's risk is isolated from
  another's.
- **No funds stuck on an absent operator.** If the operator never settles a
  bet, the player reclaims their stake after a timeout (`SETTLE_TIMEOUT`). This
  is a liveness fallback, not a path to winnings.
- **Compliance is not optional.** Bets are gated by an on-chain
  `ComplianceRegistry`; only KYC-passed addresses can play, and geofencing /
  sanctions screening run off-chain before signing. This layer is part of the
  design and is not removed.
- **Extensible.** A new game implements `IGame`, extends `GameBase`, and is
  registered. Dice and crash are just the first two.
- **API-first, so mobile is a drop-in.** All game, verification and account
  flows are HTTP. A web client or a native Android/iOS app consume the *same*
  API; adding the mobile apps later needs no backend change.

## Layout

```
contracts/
  contracts/interfaces/IGame.sol          common game interface (the extension point)
  contracts/libraries/ProvablyFair.sol    commit-reveal + dice/crash math
  contracts/core/Bankroll.sol             custody, exposure locking, payouts
  contracts/core/GameRegistry.sol         the game catalogue
  contracts/compliance/ComplianceRegistry.sol  on-chain KYC gate
  contracts/games/GameBase.sol            placement + operator settlement
  contracts/games/DiceGame.sol            dice
  contracts/games/CrashGame.sol           crash
  test/casino.test.js                     13 tests (fairness, payouts, custody, access)
backend/
  src/fairness.js     PUBLIC provably-fair verifier (mirrors the contracts)
  src/index.js        API-first server (verify, games, operator endpoints)
  src/operator.js     PROPRIETARY settlement engine — interface only (see below)
```

## The games

**Dice.** A `0..9999` percentile roll. Bet under or over a target; the payout is
the fair odds of that bet minus the house edge. A 50%-chance bet at a 1% edge
pays 1.98x.

**Crash.** The round rises to a provably-fair bust point; the player pre-commits
an auto-cashout multiplier and wins that multiple if the bust point reaches it.
The house edge is the instant-bust slice of the curve, not a cut of the payout.

## Adding a new game

1. Implement `IGame` by extending `GameBase`.
2. Compute the exact win multiplier for a bet and call `_place(...)`.
3. Implement `_isWin(bet, serverSeed)` using `ProvablyFair`.
4. Deploy, `bankroll.setGame(game, true)`, and `registry.register(game)`.

No change to the bankroll, registry, compliance or settlement flow is needed.
Plinko, Mines, Limbo and HiLo all fit this shape. External studio content
(slots, live dealer) connects through an aggregator adapter behind the same API.

## Adding Android / iOS apps

The backend is the single source of truth for games, bets and verification, over
plain HTTP/JSON. Native apps call the same endpoints the web client does
(`/games`, `/verify/*`, the account and bet routes), so the mobile apps are a
separate front-end project with **no backend changes required**. Wallet signing
on mobile uses WalletConnect against the same contracts.

## Intentionally private: the operator settlement engine

`backend/src/operator.js` is an interface-only stub on purpose. The production
operator engine is the sensitive core and is delivered as part of an engagement,
not published here. It covers:

- secure server-seed generation, storage (HSM/KMS) and rotation,
- committing `keccak256(serverSeed)` before a seed's first bet,
- driving settlement under live bankroll-exposure and risk limits,
- AML / sanctions screening feeding the on-chain compliance gate.

Everything a **player** needs to trust the house is public (the contracts and
`fairness.js`). Everything an **operator** needs to run it safely is the private
module. This is the open-core split.

## Running it

```bash
# contracts  (the test suite imports backend/src/fairness.js as a drift guard,
#             so install the backend package too — see note below)
cd backend && npm install
cd ../contracts && npm install
npx hardhat test                 # 17 passing
npx hardhat run scripts/deploy.js   # deploy + wire (set FUND_ETH / OPERATOR_ADDRESS to taste)

# backend
cd backend && npm install
npm test                         # 8 passing (fairness vectors)
node scripts/montecarlo.js 2000000   # empirical house edge
npm start
# POST /verify/dice   { serverSeed, clientSeed, nonce, target, rollOver }
# POST /verify/crash  { serverSeed, clientSeed, nonce, cashoutBps, houseEdgeBps }
# GET  /games
```

## Measured house edge (Monte Carlo, 2,000,000 rounds each)

| Game | Nominal edge | Measured RTP | Measured edge |
|---|---|---|---|
| Dice (50% target) | 1.00% | 98.94% | ~1.06% |
| Crash (cash out 2.00x) | 1.00% | 98.46% | ~1.54% |

Dice sits essentially on its 1% target. **Crash runs slightly hot (~1.5% at a
2x cashout), above the nominal 1%**, because the on-chain crash point is floored
to an integer. This is disclosed rather than hidden; if an operator needs crash
pinned to exactly 1%, the bust formula needs calibration. Re-run the numbers
with `node backend/scripts/montecarlo.js`.

## Static analysis (Slither 0.11.6)

Slither was run on the contracts; the full output is in `docs/slither-report.txt`.
The actionable findings were fixed: a reentrancy guard now wraps every
value-moving function, `GameRegistry.owner` is immutable, owner/operator changes
emit events, recipient addresses are zero-checked, and the large literals are
grouped. The remaining findings (7) are informational or by-design:

- `timestamp` — the timeout refund intentionally uses `block.timestamp`; a
  few seconds of miner drift is irrelevant to a one-hour window.
- `low-level-calls` — `.call{value:}` is the recommended way to send ETH; the
  return value is checked.
- `divide-before-multiply` — the crash formula floors by design (see the edge
  note above).
- `reentrancy-events` / `reentrancy-benign` — event emitted after an external
  call; state is updated first and the guard blocks re-entry.

This is not a substitute for a professional audit before real-money use.

## Status

| Component | State |
|---|---|
| Fairness engine (dice + crash) | Complete; contract tests import the same `fairness.js` the backend uses, so any drift fails the suite. |
| Bankroll custody, per-bet locking, per-game exposure caps | Complete, tested. |
| Operator-timeout refund | Complete, tested. |
| Compliance gate + game registry | Complete, tested. |
| Dice + Crash games | Complete, tested (17/17). |
| Deploy + wiring script | `scripts/deploy.js`, run against the in-process network. |
| Backend fairness verifier + API skeleton + tests | Complete (8/8); `/games` is static pending RPC wiring. |
| Monte Carlo house-edge check | `backend/scripts/montecarlo.js`. |
| Static analysis | Slither run; report in `docs/slither-report.txt`. |
| Operator settlement engine | Intentionally private (interface only). |
| Web frontend / native apps | Not in this repo; the API is built for them. |

Contracts compile clean under solc 0.8.24. Not audited; a professional audit is
required before real-money use.

## Legal

This is testnet-only demonstration software. Operating an online casino is a
licensed, regulated activity; the operator is solely responsible for holding a
gambling licence in a permitted jurisdiction, for KYC/AML, and for geofencing
out prohibited regions. The compliance layer here exists to be used, not
bypassed. The author does not operate a casino and does not provide a licence.

**Trust model.** Settlement is driven by a single operator key that commits and
reveals seeds. Players do not have to trust the operator for *fairness* (every
result is verifiable) but they do rely on it for *liveness*; the timeout refund
bounds that risk so a stake is never locked forever if the operator goes away.
A production deployment should also consider a multisig or VRF-backed settlement
path, which is part of the private operator engine's roadmap.

## License

MIT (contracts and public backend). The operator settlement engine is not MIT
and is not included.
