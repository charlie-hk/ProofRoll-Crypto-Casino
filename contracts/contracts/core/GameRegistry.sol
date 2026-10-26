// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IGame.sol";

// The catalogue. Frontends and mobile apps read it to discover which games are
// live. Adding a game is one registration call; the core needs no change.
contract GameRegistry {
    address public immutable owner;

    struct Entry {
        address game;
        bool active;
    }

    string[] private _ids;
    mapping(string => Entry) private _entries;

    event GameRegistered(string indexed id, address indexed game);
    event GameActive(string indexed id, bool active);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    function register(address game) external onlyOwner {
        string memory id = IGame(game).gameId();
        require(bytes(id).length != 0, "empty id");
        require(_entries[id].game == address(0), "id taken");
        _entries[id] = Entry({game: game, active: true});
        _ids.push(id);
        emit GameRegistered(id, game);
        emit GameActive(id, true);
    }

    function setActive(string calldata id, bool active) external onlyOwner {
        require(_entries[id].game != address(0), "unknown id");
        _entries[id].active = active;
        emit GameActive(id, active);
    }

    function get(string calldata id) external view returns (address game, bool active) {
        Entry memory e = _entries[id];
        return (e.game, e.active);
    }

    function ids() external view returns (string[] memory) {
        return _ids;
    }

    function count() external view returns (uint256) {
        return _ids.length;
    }
}
