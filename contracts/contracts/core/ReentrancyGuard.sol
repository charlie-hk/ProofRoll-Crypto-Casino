// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Minimal reentrancy guard (same shape as OpenZeppelin's) so the project stays
// dependency-free. Applied to every function that moves value.
abstract contract ReentrancyGuard {
    uint256 private _status = 1;

    modifier nonReentrant() {
        require(_status == 1, "reentrant");
        _status = 2;
        _;
        _status = 1;
    }
}
