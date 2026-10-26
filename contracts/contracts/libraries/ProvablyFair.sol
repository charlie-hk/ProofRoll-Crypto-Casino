// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Commit-reveal provably-fair primitives. The operator commits to
// keccak256(serverSeed) before a round; players supply their own clientSeed;
// each bet carries an incrementing nonce. Outcomes are a pure function of
// (serverSeed, clientSeed, nonce), so once the serverSeed is revealed anyone
// can replay every result.
library ProvablyFair {
    uint256 private constant E = 2 ** 52; // 52 bits of entropy, Bustabit-style

    function entropy(bytes32 serverSeed, bytes32 clientSeed, uint256 nonce)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(serverSeed, clientSeed, nonce));
    }

    function verifyCommit(bytes32 serverSeed, bytes32 commit) internal pure returns (bool) {
        return keccak256(abi.encodePacked(serverSeed)) == commit;
    }

    // Uniform integer in [0, range).
    function rollRange(bytes32 serverSeed, bytes32 clientSeed, uint256 nonce, uint256 range)
        internal
        pure
        returns (uint256)
    {
        require(range > 0, "range=0");
        return uint256(entropy(serverSeed, clientSeed, nonce)) % range;
    }

    // Dice: a 0..9999 roll, read as a percentile with two decimals (0.00..99.99).
    function diceRoll(bytes32 serverSeed, bytes32 clientSeed, uint256 nonce)
        internal
        pure
        returns (uint16)
    {
        return uint16(rollRange(serverSeed, clientSeed, nonce, 10000));
    }

    // Crash multiplier in basis points (10000 = 1.00x). With probability
    // houseEdgeBps/10000 the round instantly busts at 1.00x; that slice is the
    // entire house edge for crash.
    function crashPointBps(
        bytes32 serverSeed,
        bytes32 clientSeed,
        uint256 nonce,
        uint16 houseEdgeBps
    ) internal pure returns (uint32) {
        uint256 h = uint256(entropy(serverSeed, clientSeed, nonce)) % E;

        if (h % 10000 < houseEdgeBps) {
            return 10000;
        }

        // point in hundredths of x: 100 == 1.00x
        uint256 point100 = (100 * E - h) / (E - h);
        uint256 bps = point100 * 100;
        if (bps < 10000) bps = 10000;
        if (bps > type(uint32).max) bps = type(uint32).max;
        return uint32(bps);
    }
}
