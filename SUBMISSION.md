# Tribune — ETHGlobal Open Agents 2026

> An ERC-792-compatible AI arbitrator that any Arbitrable can drop in as a Kleros replacement, powered by 0G Compute panels with TEE-attested verdicts.

|                               |                                                                                                                                          |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Track focus**               | 0G (Compute + Storage) · KeeperHub (MCP) · Kleros (ERC-792) · ENS · Uniswap                                                              |
| **Demo runbook**              | [`docs/DEMO_SCRIPT.md`](./docs/DEMO_SCRIPT.md)                                                                                           |
| **Architecture**              | [`docs/architecture.md`](./docs/architecture.md)                                                                                         |
| **Sponsor DX feedback**       | [`FEEDBACK.md`](./FEEDBACK.md)                                                                                                           |
| **Headline credibility test** | [`packages/contracts/test/KlerosCompat.t.sol`](./packages/contracts/test/KlerosCompat.t.sol) — 3 flows, unmodified Kleros `SimpleEscrow` |
| **Run it yourself**           | `pnpm install && pnpm db:reset && pnpm dev` (boots demo profile, no env setup)                                                           |

## The problem

Onchain AI agents are starting to transact with each other — x402 payments, agent-to-agent commerce, autonomous service marketplaces. When two agents disagree, the existing answer is Kleros: human jurors, real fees, hours of latency. That doesn't fit machine-speed disputes between bots whose stakes are often a few dollars in stablecoins.

Tribune is the alternative: **an ERC-792 arbitrator whose jury is a 3-of-3 panel of distinct LLMs running on 0G Compute, returning a TEE-attested verdict in seconds.** Anything that already speaks Kleros's `IArbitrable` works against it without code changes — proven below.

## What it is, in three claims you can verify in code

### 1. It's a real ERC-792 drop-in.

[`packages/contracts/src/arbitrator/TribuneArbitrator.sol`](./packages/contracts/src/arbitrator/TribuneArbitrator.sol) implements `IArbitrator` exactly. Native-token arbitration fee, `nonReentrant` end-to-end, single-round (appeals revert per spec), verdicts gated by [`PanelRegistry`](./packages/contracts/src/arbitrator/PanelRegistry.sol) so only authorised panel signers can call `executeRuling`.

The credibility test is [`packages/contracts/test/KlerosCompat.t.sol`](./packages/contracts/test/KlerosCompat.t.sol). It deploys an **unmodified vendored copy** of Kleros's own `SimpleEscrow.sol` ([`lib/erc-792-vendored/examples/SimpleEscrow.sol`](./packages/contracts/lib/erc-792-vendored/examples/SimpleEscrow.sol), MIT, verbatim from `kleros/erc-792`) against `TribuneArbitrator` and walks three full dispute flows:

- panel rules payee → escrow releases to seller
- panel rules payer → escrow refunds to buyer
- happy path with no dispute

All three pass. **If this test is green, Tribune is a working ERC-792 arbitrator for any contract written against the standard.** No fork, no shim, no hand-wave.

```
pnpm --filter @tribune/contracts test
# 29 / 29 passing — KlerosCompat: 3 / 3
```

[`packages/contracts/test/ReentrancyAttack.t.sol`](./packages/contracts/test/ReentrancyAttack.t.sol) verifies attackers cannot recurse through `executeRuling` or the `createDispute` overpayment refund.

### 2. The panel is a real 0G Compute integration.

[`apps/panel/src/adapters/inference/og-compute.adapter.ts`](./apps/panel/src/adapters/inference/og-compute.adapter.ts) speaks the documented `@0glabs/0g-serving-broker`:

- `listService()` discovers providers
- 3 distinct model families called in parallel via `Promise.all`
- `processResponse()` runs per panelist for the TEE attestation, surfaced as a structured field on every verdict
- failures bubble as typed `InferenceError`s (timeout, rate-limit, attestation-failed)

Evidence and verdict bundles flow through [`apps/panel/src/adapters/storage/og-storage.adapter.ts`](./apps/panel/src/adapters/storage/og-storage.adapter.ts), which wraps `@0gfoundation/0g-storage-ts-sdk` with **per-reader AES-256-GCM-then-ECIES envelope encryption**. Each authorised reader gets its own envelope — there's no "key-or-nothing" leak. Storage URIs are returned as `0g://storage/<rootHash>?keys=<companionRoot>`.

The panel is wired into a **strict hexagonal architecture** ([`docs/architecture.md`](./docs/architecture.md)): the domain in [`apps/panel/src/domain/`](./apps/panel/src/domain/) imports zero infrastructure. Swapping inference, storage, execution, or identity adapters happens in one file ([`apps/panel/src/infrastructure/di/adapters.ts`](./apps/panel/src/infrastructure/di/adapters.ts)) per profile.

### 3. Demo videos are reproducible without rolling LLM dice.

[`apps/panel/src/adapters/inference/replay.adapter.ts`](./apps/panel/src/adapters/inference/replay.adapter.ts) hashes `(model, systemPrompt, userPrompt, maxTokens, temperature)` to a fixture file. In `demo` profile it runs **frozen** — a cache miss throws — so every recording is bit-identical. In `local` profile the same adapter writes through to live 0G and caches the new fixture, so going from "demo" to "live" is one env flip.

This means the credibility story holds **whether or not the judge has a funded 0G account**. They run `pnpm dev`, file a dispute, and watch the same panel reasoning the demo video shows.

## Sponsor track integrations

Each track is a real adapter living behind the panel's port boundary, picked at startup by [`apps/panel/src/infrastructure/di/adapters.ts`](./apps/panel/src/infrastructure/di/adapters.ts) based on env config.

| Track                    | Where in code                                                                                                                                                                          | Status in this submission                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **0G Compute + Storage** | [`og-compute.adapter.ts`](./apps/panel/src/adapters/inference/og-compute.adapter.ts), [`og-storage.adapter.ts`](./apps/panel/src/adapters/storage/og-storage.adapter.ts)               | Full SDK integration. Demo profile uses `ReplayAdapter` over deterministic fixtures so judges don't need a funded key. One env var flip + a funded key recovers the live path.                                                                                                                                                                                                                                                                                                                   |
| **KeeperHub MCP**        | [`onchain-keeper.adapter.ts`](./apps/panel/src/adapters/execution/onchain-keeper.adapter.ts), [`keeperhub-mcp.client.ts`](./apps/panel/src/adapters/execution/keeperhub-mcp.client.ts) | Adapter speaks the documented `keeperhub.createKeeperRun` / `keeperhub.getKeeperRun` MCP tools and submits `executeRuling` calldata for guaranteed onchain inclusion. Falls through to `DirectTxAdapter` because **0G Galileo is not in KeeperHub's listed supported chains** at the time of submission (see [`FEEDBACK.md`](./FEEDBACK.md) §KeeperHub). The integration is structurally complete — it switches on the moment KeeperHub adds Galileo or we point the panel at a supported chain. |
| **Kleros (ERC-792)**     | [`TribuneArbitrator.sol`](./packages/contracts/src/arbitrator/TribuneArbitrator.sol), [`KlerosCompat.t.sol`](./packages/contracts/test/KlerosCompat.t.sol)                             | Drop-in compatible with **unmodified** Kleros code. [`packages/contracts/script/SwapKlerosArbitrator.s.sol`](./packages/contracts/script/SwapKlerosArbitrator.s.sol) is a 30-second demo: deploys a Kleros `SimpleEscrow` against an already-deployed `TribuneArbitrator` and walks a full flow.                                                                                                                                                                                                 |
| **ENS**                  | [`ens-reputation.adapter.ts`](./apps/panel/src/adapters/identity/ens-reputation.adapter.ts)                                                                                            | Writes `tribune.disputes.{total, won, lost, last.verdict}` text records via the ENS Public Resolver. Falls through to `<name>.tribune.eth` shadow records when the panel signer doesn't own the user's ENS name. No-op when ENS isn't deployed on the active chain.                                                                                                                                                                                                                              |
| **Uniswap**              | [`uniswap-settlement.adapter.ts`](./apps/panel/src/adapters/settlement/uniswap-settlement.adapter.ts)                                                                                  | Uniswap V3 `SwapRouter02` wrapper for cross-token settlement when an Arbitrable's settlement token differs from the buyer's preferred refund token. No-op with a `uniswap_not_configured` warning when no router is set on the active chain.                                                                                                                                                                                                                                                     |

## Onchain vs offchain

| Layer                         | Onchain                                                          | Offchain                                                              |
| ----------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| Dispute lifecycle entry point | `IArbitrator.createDispute` on `TribuneArbitrator`               | `POST /disputes` on `apps/api` (development path)                     |
| Panel deliberation            | —                                                                | `apps/panel` (3-LLM parallel call to 0G Compute)                      |
| Verdict commitment            | `executeRuling` on `TribuneArbitrator`, gated by `PanelRegistry` | mirrored to Postgres via `/panel-callback/verdict` for the SSE stream |
| Evidence + verdict bundles    | merkle root committed onchain via `IEvidence.Evidence` event     | full ciphertext on 0G Storage, addressable by `0g://storage/<root>`   |
| Reputation                    | ENS text records (live path)                                     | Postgres `AgentReputation` (authoritative until ENS is wired)         |
| Settlement                    | `Arbitrable.rule()` callback fires on the escrow                 | Uniswap swap leg (when configured)                                    |

## What we shipped vs deferred

Shipped:

- ERC-792 + ERC-1497 contracts with reentrancy guards, allow-listed verdict execution, vendored Kleros compat test (3/3 passing).
- `apps/panel` strict hex service with 0G Compute + 0G Storage adapters, prompt-injection-resistant prompt (token escape, randomised choice ordering per panelist), TEE attestation surfaced per verdict.
- `apps/api` Postgres-backed dispute lifecycle, SSE stream, `/info` endpoint surfacing chainId + deployed addresses for the demo pill.
- `apps/web` Next.js 15 demo UI: file dispute, watch panel deliberate, see verdict + settlement + reputation update live.
- Replay adapter for reproducible demos.
- `FEEDBACK.md` — concrete, non-snarky DX notes for 0G + KeeperHub + Kleros.

Deferred to v2 / blocked by sponsor availability on 0G Galileo:

- **Live KeeperHub MCP submission** — adapter is wired and tested; falls back to `DirectTxAdapter` until KeeperHub routes Galileo. See [`FEEDBACK.md`](./FEEDBACK.md) §KeeperHub.
- **Live ENS writes** — `ENS_PUBLIC_RESOLVER_ADDRESS` flips the adapter on; ENS deployment on Galileo is unclear at submission time.
- **Live Uniswap cross-token settlement** — `UNISWAP_ROUTER_ADDRESS` flips the adapter on; router availability on Galileo is unclear at submission time.
- **Mainnet contract deployment, appeals, decentralised PanelRegistry** — explicit v2 scope.
- **Wallet-driven onchain dispute filing path in `apps/web`** — `wagmi.writeContract` against `ExampleEscrow.disputeTransaction`. Out of scope for the hackathon submission; the indexer adapter ([`contract-event.adapter.ts`](./apps/panel/src/adapters/trigger/contract-event.adapter.ts)) is ready to promote HTTP-filed disputes to onchain when the env is set.

## Run it yourself (no env setup needed)

```bash
git clone <repo>
cd tribune-arbitrator
pnpm install
pnpm db:reset
pnpm dev
```

Then:

- open <http://localhost:3000>, file a dispute, watch the SSE stream
- open <http://localhost:3001/info> to see the live profile + chain config
- run `pnpm --filter @tribune/contracts test` to see 29/29 forge tests pass, including the three Kleros-compat flows

## Sponsor DX feedback

We kept a running log of what worked, what was missing, and what surprised us across 0G Compute, 0G Storage, KeeperHub MCP, and Kleros's ERC-792 reference contracts. It's in [`FEEDBACK.md`](./FEEDBACK.md), with concrete code references and suggestions where applicable.
