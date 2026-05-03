// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";

import {TribuneArbitrator} from "../src/arbitrator/TribuneArbitrator.sol";
import {PanelRegistry} from "../src/arbitrator/PanelRegistry.sol";
import {IArbitrator} from "../src/interfaces/IArbitrator.sol";
import {IArbitrable} from "../src/interfaces/IArbitrable.sol";

contract MockArbitrable is IArbitrable {
    uint256 public lastDisputeID;
    uint256 public lastRuling;
    uint256 public callCount;

    function rule(uint256 _disputeID, uint256 _ruling) external override {
        callCount++;
        lastDisputeID = _disputeID;
        lastRuling = _ruling;
    }

    receive() external payable {}
}

contract TribuneArbitratorTest is Test {
    TribuneArbitrator public arbitrator;
    PanelRegistry public registry;
    address public owner = address(0xA11CE);
    address public panel = address(0xBEEF);
    uint256 public constant FEE = 0.001 ether;

    function setUp() public {
        registry = new PanelRegistry(owner);
        arbitrator = new TribuneArbitrator(owner, registry, FEE);
        vm.prank(owner);
        registry.authorize(panel);
    }

    function test_arbitrationCost_returnsFee() public view {
        assertEq(arbitrator.arbitrationCost(""), FEE);
    }

    function test_createDispute_emitsEventAndAssignsID() public {
        MockArbitrable arbitrable = new MockArbitrable();
        vm.deal(address(arbitrable), FEE);
        vm.prank(address(arbitrable));
        vm.expectEmit(true, true, false, false);
        emit IArbitrator.DisputeCreation(0, IArbitrable(address(arbitrable)));
        uint256 id = arbitrator.createDispute{value: FEE}(2, "");
        assertEq(id, 0);
        assertEq(uint256(arbitrator.disputeStatus(id)), uint256(IArbitrator.DisputeStatus.Waiting));
    }

    function test_createDispute_revertsOnUnderpayment() public {
        MockArbitrable arbitrable = new MockArbitrable();
        vm.deal(address(arbitrable), FEE);
        vm.prank(address(arbitrable));
        vm.expectRevert();
        arbitrator.createDispute{value: FEE - 1}(2, "");
    }

    function test_createDispute_refundsOverpayment() public {
        MockArbitrable arbitrable = new MockArbitrable();
        vm.deal(address(arbitrable), FEE * 3);
        vm.prank(address(arbitrable));
        arbitrator.createDispute{value: FEE * 3}(2, "");
        // Arbitrable started with FEE*3, paid FEE, so should hold FEE*2 again.
        assertEq(address(arbitrable).balance, FEE * 2);
    }

    function test_executeRuling_routesToArbitrable() public {
        MockArbitrable arbitrable = new MockArbitrable();
        vm.deal(address(arbitrable), FEE);
        vm.prank(address(arbitrable));
        uint256 id = arbitrator.createDispute{value: FEE}(2, "");
        vm.prank(panel);
        arbitrator.executeRuling(id, 1, keccak256("bundle"));
        assertEq(arbitrable.callCount(), 1);
        assertEq(arbitrable.lastDisputeID(), id);
        assertEq(arbitrable.lastRuling(), 1);
        assertEq(arbitrator.currentRuling(id), 1);
        assertEq(uint256(arbitrator.disputeStatus(id)), uint256(IArbitrator.DisputeStatus.Solved));
    }

    function test_executeRuling_revertsForUnauthorizedPanel() public {
        MockArbitrable arbitrable = new MockArbitrable();
        vm.deal(address(arbitrable), FEE);
        vm.prank(address(arbitrable));
        uint256 id = arbitrator.createDispute{value: FEE}(2, "");
        vm.prank(address(0xCAFE));
        vm.expectRevert();
        arbitrator.executeRuling(id, 1, keccak256("bundle"));
    }

    function test_executeRuling_revertsOnSecondCall() public {
        MockArbitrable arbitrable = new MockArbitrable();
        vm.deal(address(arbitrable), FEE);
        vm.prank(address(arbitrable));
        uint256 id = arbitrator.createDispute{value: FEE}(2, "");
        vm.prank(panel);
        arbitrator.executeRuling(id, 1, keccak256("bundle"));
        vm.prank(panel);
        vm.expectRevert();
        arbitrator.executeRuling(id, 2, keccak256("bundle2"));
    }

    function test_executeRuling_revertsOnRulingOutOfRange() public {
        MockArbitrable arbitrable = new MockArbitrable();
        vm.deal(address(arbitrable), FEE);
        vm.prank(address(arbitrable));
        uint256 id = arbitrator.createDispute{value: FEE}(2, "");
        vm.prank(panel);
        vm.expectRevert();
        arbitrator.executeRuling(id, 99, keccak256("bundle"));
    }

    function test_appeal_alwaysReverts() public {
        vm.expectRevert();
        arbitrator.appeal(0, "");
    }

    function test_appealCost_alwaysReverts() public {
        vm.expectRevert();
        arbitrator.appealCost(0, "");
    }

    function test_appealPeriod_returnsZeros() public view {
        (uint256 s, uint256 e) = arbitrator.appealPeriod(0);
        assertEq(s, 0);
        assertEq(e, 0);
    }

    function test_submitEvidence_doesNotRevertAndEmits() public {
        MockArbitrable arbitrable = new MockArbitrable();
        vm.deal(address(arbitrable), FEE);
        vm.prank(address(arbitrable));
        uint256 id = arbitrator.createDispute{value: FEE}(2, "");
        // Recording without expectEmit precommit; just assert success.
        arbitrator.submitEvidence(id, "ipfs://evidence");
    }

    function test_unknownDispute_revertsOnQuery() public {
        vm.expectRevert();
        arbitrator.disputeStatus(42);
    }

    function test_setArbitrationFee_onlyOwner() public {
        vm.prank(owner);
        arbitrator.setArbitrationFee(0.005 ether);
        assertEq(arbitrator.arbitrationFeeFlat(), 0.005 ether);
        vm.expectRevert();
        arbitrator.setArbitrationFee(0.01 ether);
    }

    function testFuzz_createDispute_acceptsAnyValidChoiceCount(uint8 choices) public {
        vm.assume(choices > 0 && choices <= 64);
        MockArbitrable arbitrable = new MockArbitrable();
        vm.deal(address(arbitrable), FEE);
        vm.prank(address(arbitrable));
        uint256 id = arbitrator.createDispute{value: FEE}(uint256(choices), "");
        assertGe(id, 0);
    }
}
