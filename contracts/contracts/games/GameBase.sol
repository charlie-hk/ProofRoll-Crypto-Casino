// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IGame.sol";
import "../core/Bankroll.sol";
import "../core/ReentrancyGuard.sol";
import "../compliance/ComplianceRegistry.sol";
import "../libraries/ProvablyFair.sol";

// Shared machinery for every game: commit management, KYC-gated bet placement,
// bankroll locking, and operator settlement by seed reveal. A concrete game
// only decides how a revealed seed maps to a win and a multiplier.
abstract contract GameBase is IGame, ReentrancyGuard {
    Bankroll public immutable bankroll;
    ComplianceRegistry public immutable compliance;
    address public operator;

    uint16 internal immutable _houseEdgeBps;
    uint32 internal immutable _maxMultBps;

    // If the operator never settles a bet, the player can reclaim their stake
    // after this delay. Protects players from an offline or lost-key operator;
    // it is a liveness fallback, not a path to winnings.
    uint256 public constant SETTLE_TIMEOUT = 1 hours;

    bytes32 public currentCommit; // keccak(serverSeed) for the live seed
    uint256 public betCount;

    struct Bet {
        address player;
        uint128 wager;
        uint128 locked;
        uint32 winMultBps; // payout multiple if this bet wins
        uint64 nonce;
        uint64 placedAt;
        bool settled;
        bytes32 commit;
        bytes32 clientSeed;
        bytes params;
    }

    mapping(uint256 => Bet) public bets;

    event SeedCommitted(bytes32 indexed commit);
    event BetPlaced(uint256 indexed id, address indexed player, uint256 wager, uint32 winMultBps);
    event BetSettled(uint256 indexed id, uint32 payoutMultBps, uint256 payout);
    event BetRefunded(uint256 indexed id, address indexed player, uint256 amount);
    event OperatorChanged(address indexed from, address indexed to);

    constructor(
        Bankroll bankroll_,
        ComplianceRegistry compliance_,
        address operator_,
        uint16 houseEdgeBps_,
        uint32 maxMultBps_
    ) {
        require(houseEdgeBps_ < 10000, "edge too high");
        require(maxMultBps_ > 10000, "bad max mult");
        bankroll = bankroll_;
        compliance = compliance_;
        operator = operator_ == address(0) ? msg.sender : operator_;
        _houseEdgeBps = houseEdgeBps_;
        _maxMultBps = maxMultBps_;
    }

    modifier onlyOperator() {
        require(msg.sender == operator, "not operator");
        _;
    }

    function houseEdgeBps() external view returns (uint16) {
        return _houseEdgeBps;
    }

    function maxPayoutMultiplierBps() external view returns (uint32) {
        return _maxMultBps;
    }

    function gameId() external view virtual returns (string memory);

    function commitSeed(bytes32 commit) external onlyOperator {
        require(commit != bytes32(0), "zero commit");
        currentCommit = commit;
        emit SeedCommitted(commit);
    }

    function setOperator(address op) external onlyOperator {
        require(op != address(0), "zero op");
        emit OperatorChanged(operator, op);
        operator = op;
    }

    // Child games call this from their own payable bet entrypoint after they
    // have validated params and computed the exact win multiplier.
    function _place(bytes32 clientSeed, uint32 winMultBps, bytes memory params)
        internal
        returns (uint256 id)
    {
        require(currentCommit != bytes32(0), "no live seed");
        require(compliance.isAllowed(msg.sender), "not kyc-allowed");
        require(winMultBps > 10000 && winMultBps <= _maxMultBps, "bad multiplier");
        uint256 wager = msg.value;
        require(wager > 0 && wager <= bankroll.maxBetWei(), "bad wager");

        uint256 potential = (wager * winMultBps) / 10000;
        bankroll.collect{value: wager}();
        bankroll.lock(potential);

        id = ++betCount;
        bets[id] = Bet({
            player: msg.sender,
            wager: uint128(wager),
            locked: uint128(potential),
            winMultBps: winMultBps,
            nonce: uint64(id),
            placedAt: uint64(block.timestamp),
            settled: false,
            commit: currentCommit,
            clientSeed: clientSeed,
            params: params
        });
        emit BetPlaced(id, msg.sender, wager, winMultBps);
    }

    // Liveness fallback: if the operator has not settled within SETTLE_TIMEOUT,
    // the player reclaims their stake and the lock is released.
    function claimTimeoutRefund(uint256 id) external nonReentrant {
        Bet storage b = bets[id];
        require(b.player == msg.sender, "not your bet");
        require(!b.settled, "already settled");
        require(block.timestamp >= uint256(b.placedAt) + SETTLE_TIMEOUT, "too early");

        b.settled = true;
        bankroll.resolve(b.player, b.wager, b.locked);
        emit BetRefunded(id, b.player, b.wager);
    }

    function settle(uint256 id, bytes32 serverSeed) external onlyOperator nonReentrant {
        Bet storage b = bets[id];
        require(b.player != address(0) && !b.settled, "bad bet");
        require(ProvablyFair.verifyCommit(serverSeed, b.commit), "seed/commit mismatch");

        b.settled = true;
        bool won = _isWin(b, serverSeed);
        uint256 payout = won ? (uint256(b.wager) * b.winMultBps) / 10000 : 0;

        bankroll.resolve(b.player, payout, b.locked);
        emit BetSettled(id, won ? b.winMultBps : 0, payout);
    }

    // Decide whether a bet won, given the now-revealed server seed.
    function _isWin(Bet storage b, bytes32 serverSeed) internal view virtual returns (bool);
}
