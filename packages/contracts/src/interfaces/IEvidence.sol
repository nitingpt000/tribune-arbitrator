// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IArbitrator} from "./IArbitrator.sol";
import {IArbitrable} from "./IArbitrable.sol";

/// @title IEvidence (ERC-1497)
/// @notice Evidence + meta-evidence event surface. Permissionless submission;
///         the Arbitrable contract verifies party membership.
interface IEvidence {
    event MetaEvidence(uint256 indexed _metaEvidenceID, string _evidence);

    event Evidence(
        IArbitrator indexed _arbitrator,
        uint256 indexed _evidenceGroupID,
        address indexed _party,
        string _evidence
    );

    event Dispute(
        IArbitrator indexed _arbitrator,
        uint256 indexed _disputeID,
        uint256 _metaEvidenceID,
        uint256 _evidenceGroupID
    );
}
