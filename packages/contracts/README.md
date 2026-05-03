# Tribune contracts

ERC-792 / ERC-1497 compliant arbitrator + reference Arbitrable for the Tribune
panel service. Foundry-based.

## Layout

```
src/
├── interfaces/IArbitrator.sol       ERC-792
├── interfaces/IArbitrable.sol       ERC-792
├── interfaces/IEvidence.sol         ERC-1497
├── arbitrator/TribuneArbitrator.sol the arbitrator
├── arbitrator/PanelRegistry.sol     who can submit verdicts
├── examples/ExampleEscrow.sol       reference Arbitrable
└── libraries/DisputeEncoding.sol    extraData helpers

test/
├── TribuneArbitrator.t.sol          ERC-792 surface coverage + fuzz
├── ExampleEscrow.t.sol              full happy + dispute paths
├── KlerosCompat.t.sol               unmodified Kleros SimpleEscrow
└── ReentrancyAttack.t.sol           CEI / nonReentrant guards

script/
├── Deploy.s.sol                     0G Galileo testnet deploy
├── DeployExample.s.sol              extra ExampleEscrow against existing arbitrator
└── SwapKlerosArbitrator.s.sol       KILLER DEMO: walks Kleros example end-to-end

lib/erc-792-vendored/                Verbatim copy of kleros/erc-792 (MIT). The
                                     KlerosCompat test deploys this unmodified.
```

## Quick start

```bash
cd packages/contracts
forge install
forge build
forge test               # 29 tests, all green
forge snapshot           # writes .gas-snapshot
```

Deploy to 0G Galileo testnet:

```bash
export PRIVATE_KEY=0x...               # funded testnet account
export USDC_ADDRESS=0x...              # ERC-20 used as ExampleEscrow settlement token
export PANEL_SIGNER=0x...              # address authorised to call executeRuling
forge script script/Deploy.s.sol \
  --rpc-url https://evmrpc-testnet.0g.ai \
  --broadcast --verify --slow
```

The script logs every address; copy them into
`packages/contracts/deployments/0g-testnet.json` and into the panel/api `.env`
(`ARBITRATOR_ADDRESS`, `PANEL_REGISTRY_ADDRESS`, `EXAMPLE_ESCROW_ADDRESS`,
`SETTLEMENT_TOKEN_ADDRESS`).

## Kleros compatibility

The credibility artifact for Phase 4 is `test/KlerosCompat.t.sol`. It deploys
the unmodified Kleros `SimpleEscrow.sol` (vendored verbatim under
`lib/erc-792-vendored/`) against `TribuneArbitrator` and walks three full
flows:

1. Panel rules in payee's favour → escrow settles to payee.
2. Panel rules in payer's favour → escrow refunds payer.
3. No reclaim → `releaseFunds()` happy path after the reclamation period.

If `forge test --match-contract KlerosCompatTest` is green, Tribune is a
drop-in ERC-792 arbitrator for any contract written against the standard.

## How to swap Tribune in for any ERC-792 arbitrator

1. Read your existing `IArbitrator` reference. It's the standard one — no
   subclass surface to match.
2. Replace `arbitrator: IArbitrator(<old>)` with `IArbitrator(<TribuneArbitrator address>)`
   in your Arbitrable's constructor or admin call.
3. Use `arbitrator.arbitrationCost("")` to size the fee. Tribune charges a
   flat native-token fee (default 0.001 ETH on Galileo testnet, override via
   `ARBITRATION_FEE_WEI` at deploy time).
4. Done. `createDispute()` accepts native value, returns a `disputeID`,
   emits `DisputeCreation`. Tribune's panel adjudicates and calls back into
   your contract's `rule()` via the standard interface. No appeal phase in
   v1: `appeal()` reverts, `appealPeriod()` returns zeros.

## Reentrancy

Every fund-moving function (`createDispute`, `executeRuling`, `withdrawFees`,
`createTransaction`, `confirmDelivery`, `withdraw`, `disputeTransaction`,
`rule`) is `nonReentrant`. External calls follow checks-effects-interactions:
state mutations land before any external call. `test/ReentrancyAttack.t.sol`
proves both attack vectors revert.

## Gas

`.gas-snapshot` is checked in. Notable numbers (Foundry default optimizer, 200
runs):

- `createDispute(2, "")` ~ 200 K gas (first call, with refund leg)
- `executeRuling(id, ruling, hash)` ~ 90 K gas (excludes downstream `rule()`)
- `ExampleEscrow.disputeTransaction()` ~ 230 K gas
- Full Kleros happy path (`KlerosCompat::test_klerosSimpleEscrow_paneRulesPayeeWins`) ~ 984 K gas

## Profiles

`foundry.toml` has the default profile for development. CI should run `forge
test -vvv` plus `forge snapshot --check` to catch regressions.
