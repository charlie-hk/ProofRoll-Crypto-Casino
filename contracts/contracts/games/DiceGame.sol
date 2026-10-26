// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./GameBase.sol";

// Classic crypto dice. A roll is a 0..9999 percentile. The player bets that it
// lands under or over a target; the multiplier is the fair odds of that bet
// minus the house edge.
contract DiceGame is GameBase {
    constructor(
        Bankroll bankroll_,
        ComplianceRegistry compliance_,
        address operator_,
        uint16 houseEdgeBps_
    ) GameBase(bankroll_, compliance_, operator_, houseEdgeBps_, 990_000 /* 99x cap */) {}

    function gameId() external pure override returns (string memory) {
        return "dice";
    }

    // target: 1..9998. rollOver=false pays on roll < target, true on roll > target.
    function placeBet(bytes32 clientSeed, uint16 target, bool rollOver)
        external
        payable
        nonReentrant
        returns (uint256 id)
    {
        uint256 winCount = rollOver ? (9999 - uint256(target)) : uint256(target);
        require(winCount > 0 && winCount < 10000, "bad target");

        uint32 mult = uint32(((10000 - uint256(_houseEdgeBps)) * 10000) / winCount);
        return _place(clientSeed, mult, abi.encode(target, rollOver));
    }

    function _isWin(Bet storage b, bytes32 serverSeed) internal view override returns (bool) {
        (uint16 target, bool rollOver) = abi.decode(b.params, (uint16, bool));
        uint16 roll = ProvablyFair.diceRoll(serverSeed, b.clientSeed, b.nonce);
        return rollOver ? roll > target : roll < target;
    }
}
