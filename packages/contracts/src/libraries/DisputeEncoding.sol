// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @notice Helpers for the `extraData` blob ERC-792 passes from Arbitrable to
///         Arbitrator. Tribune uses a compact tagged encoding so future fields
///         (panel size, claim type, evidence URI hint) can be added without
///         breaking existing Arbitrables.
library DisputeEncoding {
    /// @notice extraData = abi.encode(version, panelSize, claimTypeHash, evidenceUriHint)
    ///         If extraData is empty, defaults are used.
    struct ExtraData {
        uint8 version;
        uint8 panelSize;
        bytes32 claimTypeHash;
        string evidenceUriHint;
    }

    function decode(bytes calldata raw) internal pure returns (ExtraData memory data) {
        if (raw.length == 0) {
            return ExtraData({version: 1, panelSize: 3, claimTypeHash: bytes32(0), evidenceUriHint: ""});
        }
        (data.version, data.panelSize, data.claimTypeHash, data.evidenceUriHint) =
            abi.decode(raw, (uint8, uint8, bytes32, string));
    }

    function encode(ExtraData memory data) internal pure returns (bytes memory) {
        return abi.encode(data.version, data.panelSize, data.claimTypeHash, data.evidenceUriHint);
    }
}
