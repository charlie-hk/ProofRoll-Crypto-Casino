// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IGame
/// @notice Common interface every casino game implements. New games (Plinko,
///         Mines, etc.) only need to implement this and be registered in the
///         GameRegistry, so the core never changes when the catalogue grows.
interface IGame {
    /// @notice Short machine name, e.g. "dice" or "crash".
    function gameId() external view returns (string memory);

    /// @notice House edge in basis points (e.g. 100 = 1%). Used by the bankroll
    ///         to bound the maximum payout a game may request.
    function houseEdgeBps() external view returns (uint16);

    /// @notice Largest multiplier (in basis points of the stake, 10000 = 1x)
    ///         the game will accept on a single bet. The game enforces this per
    ///         bet at placement. Per-game total exposure is capped separately by
    ///         the bankroll via setMaxExposure.
    function maxPayoutMultiplierBps() external view returns (uint32);
}
