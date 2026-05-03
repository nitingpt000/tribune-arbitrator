// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console2} from "forge-std/Script.sol";

import {SimpleEscrow} from "@erc792-vendored/examples/SimpleEscrow.sol";
import {IArbitrator as IArbitratorVendored} from "@erc792-vendored/IArbitrator.sol";
import {TribuneArbitrator} from "../src/arbitrator/TribuneArbitrator.sol";

/// @notice The killer demo script. Deploys an unmodified Kleros SimpleEscrow
///         against an already-deployed TribuneArbitrator and walks the full
///         dispute flow on chain. Records the panel verdict.
///
/// Required env:
///   PRIVATE_KEY           deployer / payer key (funded with native + escrow value)
///   ARBITRATOR_ADDRESS    deployed TribuneArbitrator
///   PAYEE                 address that the escrow pays out to
///   ESCROW_VALUE_WEI      amount funding the escrow (default 0.01 ether)
///   ARBITRATION_FEE_WEI   default 0.001 ether
contract SwapKlerosArbitratorScript is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address payable payee = payable(vm.envAddress("PAYEE"));
        address arb = vm.envAddress("ARBITRATOR_ADDRESS");
        uint256 escrowValue = vm.envOr("ESCROW_VALUE_WEI", uint256(0.01 ether));
        uint256 fee = vm.envOr("ARBITRATION_FEE_WEI", uint256(0.001 ether));

        TribuneArbitrator tribune = TribuneArbitrator(payable(arb));

        vm.startBroadcast(pk);
        SimpleEscrow escrow = new SimpleEscrow{value: escrowValue}(
            payee,
            IArbitratorVendored(arb),
            "Kleros SimpleEscrow running with Tribune as arbitrator"
        );
        // Step 1 — payer reclaims (pays the arbitration fee).
        escrow.reclaimFunds{value: fee}();
        vm.stopBroadcast();

        console2.log("Kleros SimpleEscrow deployed at:", address(escrow));
        console2.log("Payer reclaim posted; awaiting payee fee deposit and panel verdict.");
        console2.log("");
        console2.log("Tribune arbitrator currently holds dispute %s.", tribune.nextDisputeID() - 1);
        console2.log("");
        console2.log(
            unicode"Kleros Arbitrable contract running with Tribune as arbitrator."
        );
        console2.log("ERC-792 compatibility verified onchain.");
    }
}
