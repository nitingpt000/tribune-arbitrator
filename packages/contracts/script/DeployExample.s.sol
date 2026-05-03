// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console2} from "forge-std/Script.sol";

import {ExampleEscrow} from "../src/examples/ExampleEscrow.sol";
import {IArbitrator} from "../src/interfaces/IArbitrator.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Deploys an additional ExampleEscrow against an already-deployed
///         TribuneArbitrator (or any ERC-792 arbitrator).
contract DeployExampleScript is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address arbitrator = vm.envAddress("ARBITRATOR_ADDRESS");
        address usdc = vm.envAddress("USDC_ADDRESS");
        uint256 disputeWindow = vm.envOr("DISPUTE_WINDOW", uint256(7 days));

        vm.startBroadcast(pk);
        ExampleEscrow escrow = new ExampleEscrow(IERC20(usdc), IArbitrator(arbitrator), disputeWindow);
        vm.stopBroadcast();

        console2.log("ExampleEscrow:", address(escrow));
        console2.log("Arbitrator   :", arbitrator);
        console2.log("Settlement   :", usdc);
    }
}
