// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console2} from "forge-std/Script.sol";

import {TribuneArbitrator} from "../src/arbitrator/TribuneArbitrator.sol";
import {PanelRegistry} from "../src/arbitrator/PanelRegistry.sol";
import {ExampleEscrow} from "../src/examples/ExampleEscrow.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Deploys TribuneArbitrator + PanelRegistry + an ExampleEscrow against
///         an existing USDC address. Assumes the deployer's address is also the
///         panel signer for v1 (single-signer panel registration).
///
/// Required env:
///   PRIVATE_KEY           deployer private key (funded on 0G Galileo testnet)
///   USDC_ADDRESS          ERC-20 used by ExampleEscrow as settlement token
///   ARBITRATION_FEE_WEI   native fee charged on createDispute (default 0.001e18)
///   PANEL_SIGNER          address authorised to call executeRuling
///                         (defaults to msg.sender if unset)
contract DeployScript is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address usdc = vm.envAddress("USDC_ADDRESS");
        uint256 fee = vm.envOr("ARBITRATION_FEE_WEI", uint256(0.001 ether));
        address panel = vm.envOr("PANEL_SIGNER", deployer);

        vm.startBroadcast(pk);
        PanelRegistry registry = new PanelRegistry(deployer);
        TribuneArbitrator arbitrator = new TribuneArbitrator(deployer, registry, fee);
        registry.authorize(panel);
        ExampleEscrow escrow = new ExampleEscrow(IERC20(usdc), arbitrator, 7 days);
        vm.stopBroadcast();

        console2.log("PanelRegistry        :", address(registry));
        console2.log("TribuneArbitrator    :", address(arbitrator));
        console2.log("ExampleEscrow        :", address(escrow));
        console2.log("Authorised panel     :", panel);
        console2.log("Arbitration fee (wei):", fee);
        console2.log("Settlement token     :", usdc);

        // Persist a JSON deployment record. The user copies this into
        // packages/contracts/deployments/0g-testnet.json.
        string memory json = string.concat(
            "{\n",
            '  "panelRegistry": "', vm.toString(address(registry)), '",\n',
            '  "tribuneArbitrator": "', vm.toString(address(arbitrator)), '",\n',
            '  "exampleEscrow": "', vm.toString(address(escrow)), '",\n',
            '  "settlementToken": "', vm.toString(usdc), '",\n',
            '  "panelSigner": "', vm.toString(panel), '",\n',
            '  "arbitrationFeeWei": "', vm.toString(fee), '"\n',
            "}\n"
        );
        console2.log("\nWrite this to packages/contracts/deployments/<network>.json:");
        console2.log(json);
    }
}
