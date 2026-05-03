// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";

import {TribuneArbitrator} from "../src/arbitrator/TribuneArbitrator.sol";
import {PanelRegistry} from "../src/arbitrator/PanelRegistry.sol";
import {IArbitrable} from "../src/interfaces/IArbitrable.sol";
import {IArbitrator} from "../src/interfaces/IArbitrator.sol";

/// @notice Recurses into the arbitrator from inside its rule() callback.
contract ReentrantArbitrable is IArbitrable {
    TribuneArbitrator public immutable arbitrator;
    bool public attempted;

    constructor(TribuneArbitrator _arbitrator) {
        arbitrator = _arbitrator;
    }

    function rule(uint256 _disputeID, uint256) external override {
        if (!attempted) {
            attempted = true;
            // try to re-enter executeRuling in the same dispute. nonReentrant should bite.
            (bool ok,) = address(arbitrator).call(
                abi.encodeWithSelector(
                    arbitrator.executeRuling.selector, _disputeID, 1, keccak256("rentry")
                )
            );
            require(!ok, "expected reentry to revert");
        }
    }
}

/// @notice Tries to recurse during the createDispute fee refund path.
contract ReentrantArbitrableOnRefund is IArbitrable {
    TribuneArbitrator public immutable arbitrator;
    bool public attempted;
    uint256 public lastID;

    constructor(TribuneArbitrator _arbitrator) {
        arbitrator = _arbitrator;
    }

    receive() external payable {
        if (!attempted) {
            attempted = true;
            (bool ok,) = address(arbitrator).call{value: 0}(
                abi.encodeWithSelector(arbitrator.createDispute.selector, uint256(2), bytes(""))
            );
            require(!ok, "expected reentry to revert (no fee + nonReentrant)");
        }
    }

    function rule(uint256, uint256) external override {}

    function attack(uint256 fee) external {
        lastID = arbitrator.createDispute{value: fee * 2}(2, "");
    }
}

contract ReentrancyAttackTest is Test {
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

    function test_executeRuling_blockedFromReentry() public {
        ReentrantArbitrable target = new ReentrantArbitrable(arbitrator);
        vm.deal(address(target), FEE);
        vm.prank(address(target));
        uint256 id = arbitrator.createDispute{value: FEE}(2, "");
        vm.prank(panel);
        arbitrator.executeRuling(id, 1, keccak256("bundle"));
        assertTrue(target.attempted());
    }

    function test_createDispute_refundReentryBlocked() public {
        ReentrantArbitrableOnRefund target = new ReentrantArbitrableOnRefund(arbitrator);
        vm.deal(address(target), FEE * 4);
        target.attack(FEE);
        // The first createDispute must have succeeded; the recursive call from
        // inside the refund hook must have reverted (nonReentrant).
        assertEq(target.lastID(), 0);
        assertTrue(target.attempted());
    }
}
