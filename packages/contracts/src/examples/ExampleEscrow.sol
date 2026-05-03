// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IArbitrable} from "../interfaces/IArbitrable.sol";
import {IArbitrator} from "../interfaces/IArbitrator.sol";
import {IEvidence} from "../interfaces/IEvidence.sol";

/// @title ExampleEscrow
/// @notice Reference Arbitrable for x402-style agent-to-agent payments. Holds
///         the disputed amount in an ERC-20 (USDC on 0G testnet); the
///         arbitrator's ruling decides where the funds go.
///
/// Ruling values:
///   0 = RefusedToArbitrate → split refund 50/50
///   1 = BuyerWins (refund) → all funds back to buyer
///   2 = SellerWins (reject) → all funds released to seller
contract ExampleEscrow is IArbitrable, IEvidence, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable settlementToken;
    IArbitrator public immutable arbitrator;
    uint256 public immutable disputeWindow;

    enum DisputeState {
        None,
        Open,
        Closed
    }

    struct Transaction {
        address buyer;
        address seller;
        uint256 amount;
        uint96 paidAt;
        DisputeState state;
        uint256 arbitratorDisputeID;
        bytes32 evidenceURIHash;
    }

    mapping(uint256 => Transaction) public transactions;
    mapping(uint256 => uint256) public arbitratorToTxId;
    uint256 public nextTxId;

    event TransactionCreated(uint256 indexed txId, address indexed buyer, address indexed seller, uint256 amount);
    event DeliveryConfirmed(uint256 indexed txId);
    event Withdrawn(uint256 indexed txId, address indexed seller, uint256 amount);
    event TransactionDisputed(uint256 indexed txId, uint256 indexed disputeID, string evidenceURI);

    error InvalidParty();
    error InvalidState();
    error WindowOpen(uint256 unlocksAt);
    error UnknownTransaction();
    error UnknownArbitrator();
    error InvalidRuling(uint256 ruling);

    constructor(IERC20 _token, IArbitrator _arbitrator, uint256 _disputeWindow) {
        settlementToken = _token;
        arbitrator = _arbitrator;
        disputeWindow = _disputeWindow;
    }

    function createTransaction(address _seller, uint256 _amount)
        external
        nonReentrant
        returns (uint256 txId)
    {
        if (_seller == address(0) || _amount == 0) revert InvalidParty();
        txId = nextTxId++;
        transactions[txId] = Transaction({
            buyer: msg.sender,
            seller: _seller,
            amount: _amount,
            paidAt: uint96(block.timestamp),
            state: DisputeState.None,
            arbitratorDisputeID: 0,
            evidenceURIHash: bytes32(0)
        });
        settlementToken.safeTransferFrom(msg.sender, address(this), _amount);
        emit TransactionCreated(txId, msg.sender, _seller, _amount);
    }

    /// @notice Buyer's happy path: confirm delivery, release funds to seller.
    function confirmDelivery(uint256 _txId) external nonReentrant {
        Transaction storage tx_ = transactions[_txId];
        if (tx_.amount == 0) revert UnknownTransaction();
        if (msg.sender != tx_.buyer) revert InvalidParty();
        if (tx_.state != DisputeState.None) revert InvalidState();
        tx_.state = DisputeState.Closed;
        uint256 amount = tx_.amount;
        settlementToken.safeTransfer(tx_.seller, amount);
        emit DeliveryConfirmed(_txId);
        emit Withdrawn(_txId, tx_.seller, amount);
    }

    /// @notice Seller pulls funds after the dispute window expires without a
    ///         dispute being filed.
    function withdraw(uint256 _txId) external nonReentrant {
        Transaction storage tx_ = transactions[_txId];
        if (tx_.amount == 0) revert UnknownTransaction();
        if (msg.sender != tx_.seller) revert InvalidParty();
        if (tx_.state != DisputeState.None) revert InvalidState();
        uint256 unlocksAt = uint256(tx_.paidAt) + disputeWindow;
        if (block.timestamp < unlocksAt) revert WindowOpen(unlocksAt);
        tx_.state = DisputeState.Closed;
        uint256 amount = tx_.amount;
        settlementToken.safeTransfer(tx_.seller, amount);
        emit Withdrawn(_txId, tx_.seller, amount);
    }

    /// @notice Either party can dispute. Pays the arbitrator's native fee.
    function disputeTransaction(uint256 _txId, string calldata _evidenceURI)
        external
        payable
        nonReentrant
    {
        Transaction storage tx_ = transactions[_txId];
        if (tx_.amount == 0) revert UnknownTransaction();
        if (msg.sender != tx_.buyer && msg.sender != tx_.seller) revert InvalidParty();
        if (tx_.state != DisputeState.None) revert InvalidState();

        uint256 disputeID = arbitrator.createDispute{value: msg.value}(2, "");
        tx_.state = DisputeState.Open;
        tx_.arbitratorDisputeID = disputeID;
        tx_.evidenceURIHash = keccak256(bytes(_evidenceURI));
        arbitratorToTxId[disputeID] = _txId;
        emit TransactionDisputed(_txId, disputeID, _evidenceURI);
        emit Evidence(arbitrator, disputeID, msg.sender, _evidenceURI);
    }

    /// @notice ERC-792 callback. Routes funds based on the ruling.
    function rule(uint256 _disputeID, uint256 _ruling) external override nonReentrant {
        if (msg.sender != address(arbitrator)) revert UnknownArbitrator();
        uint256 txId = arbitratorToTxId[_disputeID];
        Transaction storage tx_ = transactions[txId];
        if (tx_.state != DisputeState.Open) revert InvalidState();
        if (_ruling > 2) revert InvalidRuling(_ruling);

        tx_.state = DisputeState.Closed;
        uint256 amount = tx_.amount;
        if (_ruling == 1) {
            settlementToken.safeTransfer(tx_.buyer, amount);
        } else if (_ruling == 2) {
            settlementToken.safeTransfer(tx_.seller, amount);
        } else {
            // 0 = RefusedToArbitrate — split.
            uint256 half = amount / 2;
            settlementToken.safeTransfer(tx_.buyer, half);
            settlementToken.safeTransfer(tx_.seller, amount - half);
        }
        emit Ruling(arbitrator, _disputeID, _ruling);
    }
}
