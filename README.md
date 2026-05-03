# Tribune

ERC-792-compatible AI arbitrator for onchain disputes between AI agents.

This repository is a Turborepo monorepo containing the Tribune web app, API, panel service, ERC-792 contracts, and shared packages.

> **ETHGlobal Open Agents 2026 submission** — see [`SUBMISSION.md`](./SUBMISSION.md) for the writeup, [`docs/DEMO_SCRIPT.md`](./docs/DEMO_SCRIPT.md) for the demo runbook, [`FEEDBACK.md`](./FEEDBACK.md) for sponsor-DX notes, and [`packages/contracts/test/KlerosCompat.t.sol`](./packages/contracts/test/KlerosCompat.t.sol) for the ERC-792 compatibility test against unmodified Kleros code.

## Phase 4 — Onchain via ERC-792 + KeeperHub + Uniswap + ENS

What Phase 4 adds:

- **`packages/contracts`** — Foundry workspace with the ERC-792 / ERC-1497 implementation:
  - `TribuneArbitrator.sol` — implements `IArbitrator` exactly. Native-token arbitration fee (so it's a true drop-in for any Kleros-integrated Arbitrable). Reentrancy-guarded. Verdicts are gated by `PanelRegistry` so only authorised panel addresses can call `executeRuling`. Appeals revert in v1 per spec.
  - `PanelRegistry.sol` — `Ownable`-managed allow-list for panel signers. v2 can decentralise this without touching the arbitrator.
  - `ExampleEscrow.sol` — reference Arbitrable for x402-style agent payments. Holds USDC, dispatches via the standard `IArbitrator.createDispute`, accepts `rule()` callbacks, settles by ruling.
  - `lib/erc-792-vendored/` — verbatim copy of `kleros/erc-792` (MIT). The credibility test deploys their unmodified `SimpleEscrow` against `TribuneArbitrator`.
- **`test/KlerosCompat.t.sol`** — three full flows (panel rules payee, panel rules payer, no-dispute happy path). All green. **This is the headline credibility artifact for Phase 4.** If this test passes, Tribune is a drop-in ERC-792 arbitrator for any contract written against the standard.
- **`test/ReentrancyAttack.t.sol`** — attacker contracts try to recurse during `executeRuling`'s callback and during the `createDispute` overpayment refund. Both attacks revert under `nonReentrant`.
- **`script/SwapKlerosArbitrator.s.sol`** — the killer demo script. Deploys an unmodified Kleros `SimpleEscrow` against an already-deployed `TribuneArbitrator` and walks the dispute end-to-end. Recordable in ~30 seconds.
- **Panel adapters** for the new on-chain plane (hex ports unchanged):
  - `ContractEventTriggerAdapter` — `provider.on()` subscription + catchup poller for `DisputeCreation` events. Persists `lastSeenBlock` so restarts don't re-trigger past disputes.
  - `OnchainKeeperExecutionAdapter` — submits `executeRuling()` calldata via the **KeeperHub MCP** server (per the prize criteria; we do not bypass MCP with direct contract calls). The adapter wraps a `DirectTxAdapter` for the apps/api callback mirror so the SSE stream still updates immediately while KeeperHub finalises onchain.
  - `UniswapSettlementAdapter` — Uniswap v3 `SwapRouter02` wrapper for cross-token settlement when an Arbitrable's settlement token differs from the buyer's preferred refund token. No-ops with a `uniswap_not_configured` warning if the router isn't on the active chain.
  - `EnsReputationIdentityAdapter` — writes `tribune.disputes.total / won / lost / last.verdict` text records via the ENS Public Resolver. Falls through to `<name>.<tribune.eth>` shadow records when the panel signer doesn't own the user's ENS name. Read path uses `text(node, key)` + namehash.
- **`/info`** on apps/api now exposes the deployed contract addresses (`arbitrator`, `panelRegistry`, `exampleEscrow`, `settlementToken`), `chainId`, and `explorerBaseUrl`. The web demo pill reads this and shows `Onchain (testnet)` / `Replay · onchain` automatically.
- **Hex contract preserved.** No port interfaces changed in Phase 4. The Phase 3 `InferencePort`, `StoragePort`, `ExecutionPort`, `IdentityPort` carry through verbatim — Phase 4 just adds new adapters.

What still requires the user's testnet credentials to fully validate:

- Live deployment via `forge script script/Deploy.s.sol --rpc-url https://evmrpc-testnet.0g.ai --broadcast`. Needs a funded `PRIVATE_KEY` and a `USDC_ADDRESS` on 0G Galileo. The script logs every address and a copy-paste JSON for `packages/contracts/deployments/0g-testnet.json`.
- Live KeeperHub MCP submission. The adapter speaks the documented `keeperhub.createKeeperRun` / `keeperhub.getKeeperRun` tools at `KEEPERHUB_MCP_URL`. Set `KEEPERHUB_API_KEY` once you've registered with KeeperHub. When unset, the panel falls back to `DirectTxAdapter` (HTTP-only, no chain).
- Uniswap router availability on Galileo. See `FEEDBACK.md` — turn the router on by setting `UNISWAP_ROUTER_ADDRESS`.
- ENS deployment on the active chain. Set `ENS_PUBLIC_RESOLVER_ADDRESS` + `ENS_REGISTRY_ADDRESS` to enable the live ENS write path.

What's deferred to a v2:

- Mainnet deployment.
- Appeals (single-round verdicts only in v1).
- Decentralised PanelRegistry (stake / slashing / multi-signer).
- A wallet-driven onchain dispute filing path in `apps/web` (RainbowKit + `wagmi.writeContract` against `ExampleEscrow.disputeTransaction`). The current frontend files via `POST /disputes`; the Phase 4 indexer promotes this to onchain when configured.

See `packages/contracts/README.md` for the full contract surface, deployment guide, and "How to swap Tribune in for any ERC-792 arbitrator" walkthrough.

## Phase 3 — Real panel on 0G

What's new in Phase 3:

- **`apps/panel`** is a new NestJS service running the panel adjudication on a strict hex architecture. The domain (`apps/panel/src/domain/`) imports zero infrastructure — only port interfaces. Adapters in `apps/panel/src/adapters/**` are interchangeable per environment via `apps/panel/src/infrastructure/di/adapters.ts`. See `docs/architecture.md`.
- **`OgComputeAdapter`** speaks the documented `@0glabs/0g-serving-broker` API: discovers providers via `listService()`, calls 3 distinct model families in parallel via `Promise.all`, runs `processResponse()` per panelist for the TEE attestation, and surfaces failures as typed `InferenceError`s.
- **`OgStorageAdapter`** wraps `@0gfoundation/0g-storage-ts-sdk` with a per-reader AES-256-GCM-then-ECIES envelope so evidence and verdict bundles are encrypted client-side under each authorised reader.
- **`ReplayAdapter`** hashes `(model + system + user + maxTokens + temperature)` to a fixture file. In `demo` profile it runs frozen — a cache miss throws — so demo videos are reproducible without rolling the dice on a live LLM.
- **Prompt-injection-resistant system prompt** (version-tracked in `prompt-builder.ts`). Evidence is wrapped in `<<EVIDENCE_START>>/<<EVIDENCE_END>>` and the system prompt explicitly anticipates injection. Embedded `<<DISPUTE_*>>`, `<<EVIDENCE_*>>`, `<<CHOICES>>` tokens in evidence are escaped. Choice ordering is independently shuffled per panelist with seed-dependent rotation.
- **`apps/api`** drops the old `MockPanelService`. `POST /disputes` now fire-and-forgets to `apps/panel`'s `/adjudicate`. The panel posts `vote-update`, `verdict`, `settlement-step` events back to `/panel-callback/*` on `apps/api`, which writes Postgres and emits onto the existing SSE stream. **The frontend received zero changes** beyond the demo pill reading `/info` to show "Live panel" / "Replay" / "Test" / "Mock panel" based on `APP_PROFILE`.
- **Failure paths are graceful.** Per-panelist 30s timeouts, parsing failures fall to `FAILED` for that panelist, all-3-fail produces a clean `FAILED` verdict (no exceptions, no hangs, no auto-retry).

What's still deferred (Phase 4):

- No KeeperHub. `ExecutionPort` is implemented by `DirectTxAdapter` (HTTP back to `apps/api`) and `LogOnlyExecutionAdapter` (tests). Phase 4 adds a real KeeperHub adapter — same port.
- No ENS write. `IdentityPort.writeReputation()` is a no-op in `ReadonlyEnsAdapter`. Phase 4 wires the real text-record write.
- No iNFT, no ERC-7857.

See `apps/panel/SPIKE.md` for the day-1 research, the throwaway script, and the verification checklist for the live profile.

## Phase 2 — Real API and persistence

What is wired now:

- **Postgres + Prisma** with the Phase 2 schema (Dispute, Evidence, PanelVote, Verdict, SettlementStep, AgentReputation).
- **NestJS API** with full CRUD on disputes, evidence attachment, in-memory-cached stats, agent reputation auto-create, and an SSE stream at `GET /disputes/:id/stream` driven by `@nestjs/event-emitter`.
- **MockPanelService** drives the dispute lifecycle: PENDING → ADJUDICATING → 3 panel votes streamed in sequence → Verdict → 4 settlement steps → SETTLED/REJECTED. Verdict outcome is deterministic per `disputeId`. Reasoning is templated by `claimType`.
- **Web app** consumes the API via a typed `TribuneClient` and TanStack Query. The Live page subscribes to the SSE stream and invalidates the React Query cache on each event. Disputes persist across reloads; closing the browser and re-opening shows the dispute in its current state.
- **Header pill** shows `Demo · Mock panel` (configurable via `NEXT_PUBLIC_DEMO_MODE`) so it's clear the persistence is real but the panel still mocks LLM calls.

What is **not** wired in Phase 2 (deferred to Phase 3+):

- No real LLM calls — the mock panel produces deterministic outcomes.
- No smart contracts, no 0G Compute, no 0G Storage, no KeeperHub, no ENS writes.
- No authentication. Single-user mode.
- No CQRS / event sourcing / message queues.

## Prerequisites

- **Node.js** 20+
- **pnpm** 9+ (`npm install -g pnpm`)
- **Docker** (for the local Postgres database)

## Profiles

The panel service runs in one of four profiles, set by `APP_PROFILE`:

| Profile  | Inference                                                | Storage          | Use                                                   |
| -------- | -------------------------------------------------------- | ---------------- | ----------------------------------------------------- |
| `test`   | StubLlmAdapter (deterministic)                           | Memory           | CI, unit + integration tests, no key needed           |
| `demo`   | ReplayAdapter (frozen) wrapping OgComputeAdapter         | OgStorageAdapter | Demo recording — cache miss throws                    |
| `replay` | ReplayAdapter wrapping OgComputeAdapter                  | OgStorageAdapter | Recording new fixtures, requires funded key           |
| `local`  | ReplayAdapter wrapping OgComputeAdapter (writes through) | OgStorageAdapter | Live development against testnet, requires funded key |

```
pnpm dev:test    # everything stubs; no 0G calls
pnpm dev:demo    # uses checked-in fixtures; no 0G calls (frozen)
pnpm dev:local   # live calls + caches new fixtures; PANEL_PRIVATE_KEY required
```

A judge cloning the repo can run `pnpm install && pnpm db:reset && pnpm dev:demo` and file a dispute — no 0G credentials needed. Replay fixtures are checked in.

## Quick start

```bash
pnpm install
pnpm db:up           # start Postgres
pnpm db:migrate      # run Prisma migrations
pnpm db:seed         # seed 3 settled + 1 adjudicating disputes
pnpm dev             # run web (3000) + api (3001) in parallel
```

That brings up:

- Web app at <http://localhost:3000>
- API at <http://localhost:3001> (Swagger docs at <http://localhost:3001/api/docs>, health at <http://localhost:3001/health>)
- Postgres on `localhost:5432` (db `tribune`, user `tribune`, password `tribune` — **dev only**)

To start fresh:

```bash
pnpm db:reset        # drops the Postgres volume, re-creates, migrates, and re-seeds
```

To inspect the DB:

```bash
pnpm db:studio       # opens Prisma Studio on http://localhost:5555
```

## Project structure

```
tribune/
├── apps/
│   ├── web/                          Next.js 15 + React 19 + Tailwind v4
│   │   ├── src/app/(marketing)       Public landing page at /
│   │   ├── src/app/(app)             Demo: /disputes, /agents, etc.
│   │   ├── src/lib/api/              TribuneClient + RQ hooks + SSE
│   │   └── src/components            UI components (DisputeCard, PanelistCard, …)
│   └── api/                          NestJS 11 + Prisma + Postgres
│       ├── src/modules/disputes      CRUD, evidence, stats, SSE stream
│       ├── src/modules/agents        Reputation auto-create + listing
│       ├── src/modules/panel         MockPanelService (lifecycle engine)
│       ├── src/modules/stats         30s in-memory TTL cache
│       └── prisma/schema.prisma      Phase 2 schema + seed.ts
├── packages/
│   ├── ui/                           Shared React primitives
│   ├── types/                        Zod schemas + inferred TS types
│   ├── eslint-config/                Shared ESLint flat configs
│   └── tsconfig/                     Shared tsconfig presets
├── turbo.json
├── pnpm-workspace.yaml
└── docker-compose.yml
```

## Common commands

| Command            | Purpose                                             |
| ------------------ | --------------------------------------------------- |
| `pnpm dev`         | Run web + API in watch mode (parallel)              |
| `pnpm build`       | Build every workspace package                       |
| `pnpm lint`        | Lint every workspace                                |
| `pnpm type-check`  | Type-check every workspace                          |
| `pnpm test`        | Run every workspace's tests                         |
| `pnpm format`      | Prettier write across the repo                      |
| `pnpm db:up`       | Start Postgres via docker compose                   |
| `pnpm db:down`     | Stop Postgres                                       |
| `pnpm db:reset`    | Drop the volume, re-migrate, re-seed (clean slate)  |
| `pnpm db:migrate`  | Run `prisma migrate dev` against the local Postgres |
| `pnpm db:seed`     | Run `apps/api/prisma/seed.ts`                       |
| `pnpm db:generate` | Generate the Prisma client                          |
| `pnpm db:studio`   | Open Prisma Studio                                  |
| `pnpm clean`       | Remove build outputs and `node_modules`             |

Per-app commands run via Turbo's filter:

```bash
pnpm --filter @tribune/web dev
pnpm --filter @tribune/api dev
```

## Environment variables

`.env.example` files exist at the root, in `apps/api`, in `apps/panel`, and in `apps/web`. Each is a literal mirror of the Joi config schema for that app (or, for `apps/web`, the `NEXT_PUBLIC_*` keys read by the client). To onboard:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/panel/.env.example apps/panel/.env
cp apps/web/.env.example apps/web/.env.local
```

The Phase 1–3 keys are uncommented and have working defaults for the demo profile. The Phase 4 keys (contracts / KeeperHub MCP / Uniswap / ENS) are commented out so a fresh clone runs `pnpm dev` without further setup; uncomment them once you've run `forge script Deploy.s.sol` (see `packages/contracts/README.md`) and registered with KeeperHub.

| Variable                                | Used by   | Notes                                                           |
| --------------------------------------- | --------- | --------------------------------------------------------------- |
| `DATABASE_URL`                          | api       | Postgres connection string                                      |
| `API_PORT`                              | api       | Default `3001`                                                  |
| `PANEL_PORT`                            | panel     | Default `3002`                                                  |
| `WEB_PORT`                              | web       | Default `3000`                                                  |
| `WEB_ORIGIN`                            | api       | CORS allow-origin                                               |
| `LOG_LEVEL`                             | api+panel | Pino log level (default `info`)                                 |
| `APP_PROFILE`                           | api+panel | `test` / `demo` / `replay` / `local`                            |
| `PANEL_SERVICE_URL`                     | api       | Where to call /adjudicate (default `http://localhost:3002`)     |
| `TRIBUNE_API_URL`                       | panel     | Where to post callbacks (default `http://localhost:3001`)       |
| `TRIBUNE_PANEL_SHARED_SECRET`           | api+panel | Bearer for /adjudicate + /panel-callback/\*                     |
| `OG_RPC_URL`                            | panel     | 0G testnet RPC (Phase 3 inference, Phase 4 contract reads)      |
| `OG_STORAGE_INDEXER_URL`                | panel     | 0G Storage indexer                                              |
| `PANEL_PRIVATE_KEY`                     | panel     | Funded 0G testnet key (required for `local`/replay-recording)   |
| `PANEL_FIXTURES_DIR`                    | panel     | Replay fixture directory (default `./fixtures`)                 |
| `NEXT_PUBLIC_API_URL`                   | web       | API base URL                                                    |
| `NEXT_PUBLIC_DEMO_MODE`                 | web       | Pill fallback when `/info` is unreachable                       |
| `NEXT_PUBLIC_OG_CHAIN_ID`               | web       | 0G Chain id (testnet `16601`)                                   |
| `NEXT_PUBLIC_OG_RPC_URL`                | web       | 0G RPC endpoint                                                 |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`  | web       | RainbowKit / WalletConnect project id                           |
| **Phase 4 (commented out by default):** |           |                                                                 |
| `CHAIN_ID`                              | api+panel | EVM chain id of the deployed arbitrator                         |
| `EXPLORER_BASE_URL`                     | api       | e.g. `https://chainscan-galileo.0g.ai`                          |
| `ARBITRATOR_ADDRESS`                    | api+panel | TribuneArbitrator deployment                                    |
| `PANEL_REGISTRY_ADDRESS`                | api       | PanelRegistry deployment                                        |
| `EXAMPLE_ESCROW_ADDRESS`                | api+panel | Reference Arbitrable deployment                                 |
| `SETTLEMENT_TOKEN_ADDRESS`              | api       | ERC-20 used by ExampleEscrow (typically USDC)                   |
| `ARBITRATOR_START_BLOCK`                | panel     | Block to start the contract-event indexer from                  |
| `KEEPERHUB_MCP_URL`                     | panel     | KeeperHub MCP endpoint (turns on OnchainKeeperExecutionAdapter) |
| `KEEPERHUB_API_KEY`                     | panel     | KeeperHub bearer token                                          |
| `UNISWAP_ROUTER_ADDRESS`                | panel     | V3 SwapRouter02 for cross-token settlement (no-op when unset)   |
| `ENS_PUBLIC_RESOLVER_ADDRESS`           | panel     | Turns on EnsReputationIdentityAdapter when paired with the key  |
| `ENS_REGISTRY_ADDRESS`                  | panel     | ENS registry on the active chain                                |
| `ENS_SUBNAME_SPACE`                     | panel     | Default `tribune.eth` for shadow records                        |

## Tests

```bash
pnpm test                                # everything via turbo
pnpm --filter @tribune/api exec jest     # API only
pnpm --filter @tribune/web exec jest     # web only
```

API tests cover:

- `MockPanelService` unit test — runs the full lifecycle with mocked timers and asserts deterministic verdict outcome by `hash(disputeId) % 10 < 7`.
- `POST /disputes` integration test — files a dispute against a live Postgres, polls until SETTLED/REJECTED, asserts verdict + 3 voted panelists.
- `GET /disputes/stats` smoke test — asserts the response shape.

Web tests cover:

- `TribuneClient` URL/error shape — list query params, JSON body serialisation, `ApiError` parsing on non-2xx, `NetworkError` on fetch failure.

## License

See `LICENSE`.
