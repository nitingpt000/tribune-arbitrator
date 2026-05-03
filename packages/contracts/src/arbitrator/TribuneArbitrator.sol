// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IArbitrator} from "../interfaces/IArbitrator.sol";
import {IArbitrable} from "../interfaces/IArbitrable.sol";
import {IEvidence} from "../interfaces/IEvidence.sol";
import {DisputeEncoding} from "../libraries/DisputeEncoding.sol";
import {PanelRegistry} from "./PanelRegistry.sol";

/// @title TribuneArbitrator
/// @notice ERC-792 + ERC-1497 compliant arbitrator. Disputes are resolved by an
///         off-chain panel of LLM jurors operated by Tribune; verdicts are
///         submitted on-chain by an authorised panel address (see PanelRegistry).
///         Appeals are not supported in v1: appeal() and appealCost() revert,
///         appealPeriod() returns (0, 0).
contract TribuneArbitrator is IArbitrator, IEvidence, ReentrancyGuard, Ownable {
    using DisputeEncoding for bytes;

    struct DisputeRecord {
        IArbitrable arbitrable;
        uint96 createdAt;
        uint8 choices;
        uint8 panelSize;
        DisputeStatus status;
        uint256 ruling;
        uint256 fee;
        bytes32 bundleHash;
    }

    /// @notice Native-token arbitration fee (ERC-792 createDispute is `payable`).
    ///         Charging native ETH keeps Tribune drop-in compatible with any
    ///         existing Arbitrable contract written against the standard.
    uint256 public arbitrationFeeFlat;

    PanelRegistry public immutable panelRegistry;

    mapping(uint256 => DisputeRecord) private _disputes;
    uint256 public nextDisputeID;

    /// @notice Emitted when a panel address writes a verdict on chain. Indexers
    ///         key on this for the user-facing "verdict written" milestone.
    event VerdictBundle(
        uint256 indexed disputeID,
        bytes32 indexed bundleHash,
        address indexed panel
    );

    /// @notice Emitted when the arbitration fee is changed by the owner.
    event ArbitrationFeeChanged(uint256 oldFee, uint256 newFee);

    error AppealsNotSupported();
    error AlreadyResolved(uint256 disputeID);
    error UnauthorizedPanel(address panel);
    error InsufficientFee(uint256 available, uint256 required);
    error InvalidRuling(uint256 ruling, uint256 choices);
    error UnknownDispute(uint256 disputeID);
    error FeeRefundFailed();
    error InvalidChoices();

    constructor(address initialOwner, PanelRegistry registry, uint256 feeFlat)
        Ownable(initialOwner)
    {
        panelRegistry = registry;
        arbitrationFeeFlat = feeFlat;
        emit ArbitrationFeeChanged(0, feeFlat);
    }

    // ──────────────────────────────────────────────────────────────────────
    // ERC-792 — required surface
    // ──────────────────────────────────────────────────────────────────────

    function createDispute(uint256 _choices, bytes calldata _extraData)
        external
        payable
        override
        nonReentrant
        returns (uint256 disputeID)
    {
        if (_choices == 0 || _choices > type(uint8).max) revert InvalidChoices();
        uint256 required = arbitrationFeeFlat;
        if (msg.value < required) revert InsufficientFee(msg.value, required);

        DisputeEncoding.ExtraData memory ed = DisputeEncoding.decode(_extraData);
        uint8 panelSize = ed.panelSize == 0 ? 3 : ed.panelSize;

        disputeID = nextDisputeID++;
        _disputes[disputeID] = DisputeRecord({
            arbitrable: IArbitrable(msg.sender),
            createdAt: uint96(block.timestamp),
            choices: uint8(_choices),
            panelSize: panelSize,
            status: DisputeStatus.Waiting,
            ruling: 0,
            fee: required,
            bundleHash: bytes32(0)
        });

        emit DisputeCreation(disputeID, IArbitrable(msg.sender));

        // Refund any overpayment in the same call (checks-effects-interactions).
        if (msg.value > required) {
            uint256 refund = msg.value - required;
            (bool ok,) = payable(msg.sender).call{value: refund}("");
            if (!ok) revert FeeRefundFailed();
        }
    }

    function arbitrationCost(bytes calldata) external view override returns (uint256) {
        return arbitrationFeeFlat;
    }

    function appeal(uint256, bytes calldata) external payable override {
        revert AppealsNotSupported();
    }

    function appealCost(uint256, bytes calldata) external pure override returns (uint256) {
        revert AppealsNotSupported();
    }

    function appealPeriod(uint256) external pure override returns (uint256 start, uint256 end) {
        return (0, 0);
    }

    function disputeStatus(uint256 _disputeID) external view override returns (DisputeStatus) {
        DisputeRecord storage d = _disputes[_disputeID];
        if (d.createdAt == 0) revert UnknownDispute(_disputeID);
        return d.status;
    }

    function currentRuling(uint256 _disputeID) external view override returns (uint256) {
        DisputeRecord storage d = _disputes[_disputeID];
        if (d.createdAt == 0) revert UnknownDispute(_disputeID);
        return d.ruling;
    }

    // ──────────────────────────────────────────────────────────────────────
    // ERC-1497 — evidence event emitter (permissionless)
    // ──────────────────────────────────────────────────────────────────────

    /// @notice Re-emits ERC-1497 Evidence with the arbitrator-relative
    ///         evidenceGroupID (= disputeID). The Arbitrable verifies that the
    ///         submitter is a party to the dispute; we just relay.
    function submitEvidence(uint256 _disputeID, string calldata _evidence) external {
        DisputeRecord storage d = _disputes[_disputeID];
        if (d.createdAt == 0) revert UnknownDispute(_disputeID);
        emit Evidence(IArbitrator(address(this)), _disputeID, msg.sender, _evidence);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Tribune panel hot path
    // ──────────────────────────────────────────────────────────────────────

    /// @notice Called by an authorised panel address with the verdict. Records
    ///         the bundle hash, marks the dispute Solved, and routes through to
    ///         the Arbitrable contract's `rule()` callback.
    function executeRuling(uint256 _disputeID, uint256 _ruling, bytes32 _bundleHash)
        external
        nonReentrant
    {
        if (!panelRegistry.isAuthorized(msg.sender)) revert UnauthorizedPanel(msg.sender);
        DisputeRecord storage d = _disputes[_disputeID];
        if (d.createdAt == 0) revert UnknownDispute(_disputeID);
        if (d.status != DisputeStatus.Waiting) revert AlreadyResolved(_disputeID);
        if (_ruling > d.choices) revert InvalidRuling(_ruling, d.choices);

        d.status = DisputeStatus.Solved;
        d.ruling = _ruling;
        d.bundleHash = _bundleHash;
        IArbitrable arbitrable = d.arbitrable;

        emit VerdictBundle(_disputeID, _bundleHash, msg.sender);

        // External call last (CEI). The arbitrable contract is responsible for
        // emitting its own Ruling event per ERC-792.
        arbitrable.rule(_disputeID, _ruling);
    }

    /// @notice Owner-only setter, for fee updates as 0G economics evolve.
    function setArbitrationFee(uint256 newFee) external onlyOwner {
        emit ArbitrationFeeChanged(arbitrationFeeFlat, newFee);
        arbitrationFeeFlat = newFee;
    }

    /// @notice Owner-only fee withdrawal (treasury). Pull pattern, never push
    ///         during executeRuling().
    function withdrawFees(address payable to, uint256 amount) external onlyOwner nonReentrant {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert FeeRefundFailed();
    }

    function getDispute(uint256 _disputeID) external view returns (DisputeRecord memory) {
        DisputeRecord storage d = _disputes[_disputeID];
        if (d.createdAt == 0) revert UnknownDispute(_disputeID);
        return d;
    }

    /// @notice Allow the contract to accept the ERC-792 createDispute fee plus
    ///         any direct deposits used to sponsor disputes.
    receive() external payable {}
}
