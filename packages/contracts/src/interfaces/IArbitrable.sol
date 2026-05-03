// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IArbitrator} from "./IArbitrator.sol";

/// @title IArbitrable (ERC-792)
/// @notice Standard interface a contract must implement to be ruled by an arbitrator.
interface IArbitrable {
    event Ruling(IArbitrator indexed _arbitrator, uint256 indexed _disputeID, uint256 _ruling);

    /// @notice Called by the arbitrator to give a ruling for a dispute.
    function rule(uint256 _disputeID, uint256 _ruling) external;
}
