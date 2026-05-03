// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";

import {TribuneArbitrator} from "../src/arbitrator/TribuneArbitrator.sol";
import {PanelRegistry} from "../src/arbitrator/PanelRegistry.sol";
import {IArbitrator as IArbitratorVendored} from
    "@erc792-vendored/IArbitrator.sol";
import {SimpleEscrow} from "@erc792-vendored/examples/SimpleEscrow.sol";

/// @title Kleros ERC-792 compatibility test
/// @notice Deploys the unmodified Kleros SimpleEscrow (vendored verbatim under
///         lib/erc-792-vendored) against TribuneArbitrator and walks the full
///         dispute flow. If this passes, Tribune is a drop-in ERC-792 arbitrator
///         for any contract written against the standard.
///
///         This is the headline credibility artifact for Phase 4.
contract KlerosCompatTest is Test {
    TribuneArbitrator public arbitrator;
    PanelRegistry public registry;
    address public owner = address(0xA11CE);
    address public panel = address(0xBEEF);
    address payable public payer;
    address payable public payee;
    uint256 public constant FEE = 0.001 ether;
    uint256 public constant ESCROW_VALUE = 1 ether;

    function setUp() public {
        registry = new PanelRegistry(owner);
        arbitrator = new TribuneArbitrator(owner, registry, FEE);
        vm.prank(owner);
        registry.authorize(panel);
        payer = payable(address(0x1111));
        payee = payable(address(0x2222));
        vm.deal(payer, 5 ether);
        vm.deal(payee, 5 ether);
    }

    /// @notice The full happy adversarial flow against the Kleros example
    ///         contract: payer reclaims, payee deposits arbitration fee, panel
    ///         rules in payee's favour, payee receives the funds.
    function test_klerosSimpleEscrow_paneRulesPayeeWins() public {
        // Step 1: payer deploys the Kleros escrow with TribuneArbitrator.
        vm.prank(payer);
        SimpleEscrow escrow = new SimpleEscrow{value: ESCROW_VALUE}(
            payee,
            IArbitratorVendored(address(arbitrator)),
            "Tribune ERC-792 compatibility test"
        );
        assertEq(address(escrow).balance, ESCROW_VALUE);

        // Step 2: payer reclaims within the reclamation period, paying the fee.
        vm.prank(payer);
        escrow.reclaimFunds{value: FEE}();
        assertEq(uint256(escrow.status()), uint256(SimpleEscrow.Status.Reclaimed));

        // Step 3: payee deposits the arbitration fee → opens the dispute.
        vm.prank(payee);
        escrow.depositArbitrationFeeForPayee{value: FEE}();
        assertEq(uint256(escrow.status()), uint256(SimpleEscrow.Status.Disputed));

        // Step 4: panel rules in favour of the payee (option 2 = PayeeWins).
        uint256 payeeBalanceBefore = payee.balance;
        vm.prank(panel);
        arbitrator.executeRuling(0, 2, keccak256("verdict-bundle"));

        // Step 5: assertions. The Kleros contract should have transferred the
        // escrow + reclaim fee to the payee and emitted Ruling.
        assertEq(uint256(escrow.status()), uint256(SimpleEscrow.Status.Resolved));
        assertGt(payee.balance, payeeBalanceBefore);
        assertEq(address(escrow).balance, 0);
    }

    function test_klerosSimpleEscrow_panelRulesPayerWins() public {
        vm.prank(payer);
        SimpleEscrow escrow = new SimpleEscrow{value: ESCROW_VALUE}(
            payee,
            IArbitratorVendored(address(arbitrator)),
            "Tribune compat (payer wins)"
        );
        vm.prank(payer);
        escrow.reclaimFunds{value: FEE}();
        vm.prank(payee);
        escrow.depositArbitrationFeeForPayee{value: FEE}();

        uint256 payerBalanceBefore = payer.balance;
        vm.prank(panel);
        arbitrator.executeRuling(0, 1, keccak256("verdict-bundle"));

        assertEq(uint256(escrow.status()), uint256(SimpleEscrow.Status.Resolved));
        assertGt(payer.balance, payerBalanceBefore);
    }

    function test_klerosSimpleEscrow_releaseFundsHappyPath() public {
        vm.prank(payer);
        SimpleEscrow escrow = new SimpleEscrow{value: ESCROW_VALUE}(
            payee,
            IArbitratorVendored(address(arbitrator)),
            "Tribune compat (no dispute)"
        );
        skip(escrow.reclamationPeriod() + 1);
        uint256 payeeBefore = payee.balance;
        escrow.releaseFunds();
        assertEq(payee.balance, payeeBefore + ESCROW_VALUE);
    }
}
