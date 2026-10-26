// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./GameBase.sol";

// Crash. The round rises to a provably-fair bust point; the player pre-commits
// to an auto-cashout multiplier and wins that multiple if the bust point
// reaches it. The house edge lives in the bust curve, not in the payout.
contract CrashGame is GameBase {
    constructor(
        Bankroll bankroll_,
        ComplianceRegistry compliance_,
        address operator_,
        uint16 houseEdgeBps_
    ) GameBase(bankroll_, compliance_, operator_, houseEdgeBps_, 1_000_000 /* 100x cap */) {}

    function gameId() external pure override returns (string memory) {
        return "crash";
    }

    // cashoutBps is the auto-cashout multiplier (10001 = 1.0001x .. up to the cap).
    function placeBet(bytes32 clientSeed, uint32 cashoutBps)
        external
        payable
        nonReentrant
        returns (uint256 id)
    {
        require(cashoutBps > 10000 && cashoutBps <= _maxMultBps, "bad cashout");
        return _place(clientSeed, cashoutBps, abi.encode(cashoutBps));
    }

    function _isWin(Bet storage b, bytes32 serverSeed) internal view override returns (bool) {
        uint32 cashoutBps = abi.decode(b.params, (uint32));
        uint32 bust = ProvablyFair.crashPointBps(serverSeed, b.clientSeed, b.nonce, _houseEdgeBps);
        return bust >= cashoutBps;
    }
}
