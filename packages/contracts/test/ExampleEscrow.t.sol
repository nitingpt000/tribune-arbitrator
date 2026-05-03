// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";

import {TribuneArbitrator} from "../src/arbitrator/TribuneArbitrator.sol";
import {PanelRegistry} from "../src/arbitrator/PanelRegistry.sol";
import {ExampleEscrow} from "../src/examples/ExampleEscrow.sol";
import {MockERC20} from "./utils/MockERC20.sol";

contract ExampleEscrowTest is Test {
    TribuneArbitrator public arbitrator;
    PanelRegistry public registry;
    ExampleEscrow public escrow;
    MockERC20 public usdc;
    address public owner = address(0xA11CE);
    address public panel = address(0xBEEF);
    address public buyer = address(0xB0B);
    address public seller = address(0x5E11E);
    uint256 public constant FEE = 0.001 ether;
    uint256 public constant AMOUNT = 1_000 * 10 ** 6; // 1000 USDC
    uint256 public constant DISPUTE_WINDOW = 7 days;

    function setUp() public {
        registry = new PanelRegistry(owner);
        arbitrator = new TribuneArbitrator(owner, registry, FEE);
        usdc = new MockERC20("USDC", "USDC", 6);
        escrow = new ExampleEscrow(usdc, arbitrator, DISPUTE_WINDOW);
        vm.prank(owner);
        registry.authorize(panel);
        usdc.mint(buyer, AMOUNT * 10);
        vm.deal(buyer, FEE * 10);
        vm.deal(seller, FEE * 10);
    }

    function _createTx() internal returns (uint256 txId) {
        vm.startPrank(buyer);
        usdc.approve(address(escrow), AMOUNT);
        txId = escrow.createTransaction(seller, AMOUNT);
        vm.stopPrank();
    }

    function test_createTransaction_holdsFunds() public {
        uint256 txId = _createTx();
        assertEq(usdc.balanceOf(address(escrow)), AMOUNT);
        (address b,, uint256 a,,,, ) = escrow.transactions(txId);
        assertEq(b, buyer);
        assertEq(a, AMOUNT);
    }

    function test_confirmDelivery_releasesToSeller() public {
        uint256 txId = _createTx();
        vm.prank(buyer);
        escrow.confirmDelivery(txId);
        assertEq(usdc.balanceOf(seller), AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_withdraw_blockedDuringWindow() public {
        uint256 txId = _createTx();
        vm.prank(seller);
        vm.expectRevert();
        escrow.withdraw(txId);
    }

    function test_withdraw_succeedsAfterWindow() public {
        uint256 txId = _createTx();
        skip(DISPUTE_WINDOW + 1);
        vm.prank(seller);
        escrow.withdraw(txId);
        assertEq(usdc.balanceOf(seller), AMOUNT);
    }

    function test_disputeFlow_buyerWinsRefund() public {
        uint256 txId = _createTx();
        vm.prank(buyer);
        escrow.disputeTransaction{value: FEE}(txId, "ipfs://buyer-evidence");
        (,,,, ExampleEscrow.DisputeState state, uint256 disputeID,) = escrow.transactions(txId);
        assertEq(uint256(state), uint256(ExampleEscrow.DisputeState.Open));

        vm.prank(panel);
        arbitrator.executeRuling(disputeID, 1, keccak256("bundle"));

        assertEq(usdc.balanceOf(buyer), AMOUNT * 10); // started 10x, paid 1x, got 1x back
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_disputeFlow_sellerWinsRelease() public {
        uint256 txId = _createTx();
        vm.prank(seller);
        escrow.disputeTransaction{value: FEE}(txId, "ipfs://seller-evidence");
        (,,,, , uint256 disputeID,) = escrow.transactions(txId);
        vm.prank(panel);
        arbitrator.executeRuling(disputeID, 2, keccak256("bundle"));
        assertEq(usdc.balanceOf(seller), AMOUNT);
    }

    function test_disputeFlow_refusedToArbitrate_splitsHalf() public {
        uint256 txId = _createTx();
        vm.prank(buyer);
        escrow.disputeTransaction{value: FEE}(txId, "ipfs://both");
        (,,,, , uint256 disputeID,) = escrow.transactions(txId);
        vm.prank(panel);
        arbitrator.executeRuling(disputeID, 0, keccak256("bundle"));
        uint256 half = AMOUNT / 2;
        assertEq(usdc.balanceOf(buyer), AMOUNT * 10 - AMOUNT + half);
        assertEq(usdc.balanceOf(seller), AMOUNT - half);
    }

    function test_dispute_cannotBeFiledByThirdParty() public {
        uint256 txId = _createTx();
        address eve = address(0xE5E);
        vm.deal(eve, FEE);
        vm.prank(eve);
        vm.expectRevert();
        escrow.disputeTransaction{value: FEE}(txId, "ipfs://noise");
    }

    function test_rule_revertsIfNotArbitrator() public {
        uint256 txId = _createTx();
        vm.prank(buyer);
        escrow.disputeTransaction{value: FEE}(txId, "ipfs://x");
        (,,,, , uint256 disputeID,) = escrow.transactions(txId);
        vm.prank(buyer);
        vm.expectRevert();
        escrow.rule(disputeID, 1);
    }
}
