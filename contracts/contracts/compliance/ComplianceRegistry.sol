// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// On-chain KYC gate. Geofencing and sanctions screening happen off-chain in the
// backend before a player is ever allowed to sign; this registry is the
// enforceable on-chain record of who passed. Games refuse bets from addresses
// that are not allowed here, so compliance cannot be bypassed by calling the
// contracts directly.
contract ComplianceRegistry {
    address public admin;
    mapping(address => bool) private _allowed;

    event Allowed(address indexed user, bool allowed);
    event AdminTransferred(address indexed from, address indexed to);

    constructor(address admin_) {
        admin = admin_ == address(0) ? msg.sender : admin_;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "not admin");
        _;
    }

    function setAllowed(address user, bool value) external onlyAdmin {
        _allowed[user] = value;
        emit Allowed(user, value);
    }

    function setAllowedBatch(address[] calldata users, bool value) external onlyAdmin {
        for (uint256 i = 0; i < users.length; i++) {
            _allowed[users[i]] = value;
            emit Allowed(users[i], value);
        }
    }

    function isAllowed(address user) external view returns (bool) {
        return _allowed[user];
    }

    function transferAdmin(address to) external onlyAdmin {
        require(to != address(0), "zero admin");
        emit AdminTransferred(admin, to);
        admin = to;
    }
}
