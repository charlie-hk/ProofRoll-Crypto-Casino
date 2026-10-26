// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ReentrancyGuard.sol";

// House liquidity and custody. Holds the native-token bankroll, receives losing
// wagers, and pays winners. Only authorised game contracts can touch it, and
// every open bet locks its worst-case payout so the house can never promise
// more than it holds.
contract Bankroll is ReentrancyGuard {
    address public owner;
    uint256 public locked; // worst-case exposure across all open bets
    uint256 public maxBetWei;

    mapping(address => bool) public isGame;
    // Per-game exposure: current locked amount and an optional cap. A cap of 0
    // means "no per-game limit" (only the global reserve check applies). This is
    // what isolates one game's risk from another's.
    mapping(address => uint256) public lockedByGame;
    mapping(address => uint256) public maxExposureByGame;

    event GameSet(address indexed game, bool enabled);
    event ExposureCapSet(address indexed game, uint256 cap);
    event OwnershipTransferred(address indexed from, address indexed to);
    event Funded(address indexed from, uint256 amount);
    event LiquidityRemoved(address indexed to, uint256 amount);
    event Locked(address indexed game, uint256 amount);
    event Resolved(address indexed game, address indexed player, uint256 payout, uint256 unlocked);

    constructor(uint256 maxBetWei_) {
        owner = msg.sender;
        maxBetWei = maxBetWei_;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyGame() {
        require(isGame[msg.sender], "not game");
        _;
    }

    function setGame(address game, bool enabled) external onlyOwner {
        isGame[game] = enabled;
        emit GameSet(game, enabled);
    }

    function setMaxBet(uint256 v) external onlyOwner {
        maxBetWei = v;
    }

    function setMaxExposure(address game, uint256 cap) external onlyOwner {
        maxExposureByGame[game] = cap;
        emit ExposureCapSet(game, cap);
    }

    // Liquidity providers (here, the owner) top up the house.
    function fund() external payable {
        emit Funded(msg.sender, msg.value);
    }

    function removeLiquidity(uint256 amount, address to) external onlyOwner nonReentrant {
        require(to != address(0), "zero recipient");
        require(amount <= available(), "would under-collateralise");
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "transfer failed");
        emit LiquidityRemoved(to, amount);
    }

    // Free reserves not already committed to an open bet.
    function available() public view returns (uint256) {
        return address(this).balance - locked;
    }

    function reserves() external view returns (uint256) {
        return address(this).balance;
    }

    // A game forwards the player's wager here as it is placed.
    function collect() external payable onlyGame {}

    // Reserve the worst-case payout for a freshly placed bet.
    function lock(uint256 amount) external onlyGame {
        require(available() >= amount, "insufficient reserves");
        uint256 cap = maxExposureByGame[msg.sender];
        require(cap == 0 || lockedByGame[msg.sender] + amount <= cap, "game exposure cap");
        locked += amount;
        lockedByGame[msg.sender] += amount;
        emit Locked(msg.sender, amount);
    }

    // Settle a bet: release its lock and pay the player if they won.
    function resolve(address player, uint256 payout, uint256 lockedAmount) external onlyGame nonReentrant {
        require(player != address(0), "zero player");
        require(lockedAmount <= lockedByGame[msg.sender], "bad unlock");
        require(payout <= lockedAmount, "payout exceeds lock");
        locked -= lockedAmount;
        lockedByGame[msg.sender] -= lockedAmount;
        if (payout > 0) {
            (bool ok, ) = payable(player).call{value: payout}("");
            require(ok, "payout failed");
        }
        emit Resolved(msg.sender, player, payout, lockedAmount);
    }

    function transferOwnership(address to) external onlyOwner {
        require(to != address(0), "zero owner");
        emit OwnershipTransferred(owner, to);
        owner = to;
    }
}
