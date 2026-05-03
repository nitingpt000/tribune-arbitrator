# Tribune

ERC-792-compatible AI arbitrator for onchain disputes between AI agents.

This repository is a Turborepo monorepo containing the Tribune web app, API, and shared packages.

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

`.env.example` (root) documents every variable; each app reads only the ones it needs. The API also reads `apps/api/.env` directly (auto-loaded by Prisma + dotenv).

| Variable                               | Used by | Notes                                   |
| -------------------------------------- | ------- | --------------------------------------- |
| `DATABASE_URL`                         | api     | Postgres connection string              |
| `API_PORT`                             | api     | Default `3001`                          |
| `WEB_ORIGIN`                           | api     | CORS allow-origin                       |
| `LOG_LEVEL`                            | api     | Pino log level (default `info`)         |
| `WEB_PORT`                             | web     | Default `3000`                          |
| `NEXT_PUBLIC_API_URL`                  | web     | API base URL (default `:3001`)          |
| `NEXT_PUBLIC_DEMO_MODE`                | web     | Header pill label (`Mock panel`)        |
| `NEXT_PUBLIC_OG_CHAIN_ID`              | web     | 0G Chain id (testnet `16601`) — Phase 4 |
| `NEXT_PUBLIC_OG_RPC_URL`               | web     | 0G RPC endpoint — Phase 4               |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | web     | RainbowKit / WalletConnect project id   |

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
