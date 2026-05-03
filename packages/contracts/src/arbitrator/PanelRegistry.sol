// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title PanelRegistry
/// @notice Tracks which panel-service public keys can submit verdicts to the
///         arbitrator. Owner-managed in v1; v2 may decentralise this with
///         stake/slashing without changing TribuneArbitrator's surface.
contract PanelRegistry is Ownable {
    mapping(address => bool) private _authorized;

    event PanelAuthorized(address indexed panel);
    event PanelRevoked(address indexed panel);

    error AlreadyAuthorized();
    error NotAuthorized();

    constructor(address initialOwner) Ownable(initialOwner) {}

    function authorize(address panel) external onlyOwner {
        if (_authorized[panel]) revert AlreadyAuthorized();
        _authorized[panel] = true;
        emit PanelAuthorized(panel);
    }

    function revoke(address panel) external onlyOwner {
        if (!_authorized[panel]) revert NotAuthorized();
        _authorized[panel] = false;
        emit PanelRevoked(panel);
    }

    function isAuthorized(address panel) external view returns (bool) {
        return _authorized[panel];
    }
}
