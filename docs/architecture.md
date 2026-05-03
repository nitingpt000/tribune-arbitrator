# Tribune architecture

```
┌─────────────────────────┐
│  apps/web (Next.js 15)  │
│  Reads /info, lists,    │
│  files, watches SSE     │
└────────────┬────────────┘
             │  HTTP + SSE
             ▼
┌─────────────────────────┐         ┌──────────────────────────────┐
│   apps/api (NestJS)     │ ───────▶│   apps/panel (NestJS, hex)   │
│   Postgres / Prisma     │  POST   │                              │
│   /disputes (CRUD)      │  /adju  │  ┌────────────────────────┐  │
│   /disputes/:id/stream  │  dicate │  │  domain                │  │
│   /panel-callback/*     │ ◀──────-│  │  AdjudicationService   │  │
│   /info  /health        │  POST   │  │  PromptBuilder         │  │
└─────────────────────────┘  /pcb/* │  │  PanelVoteAggregator   │  │
                                    │  │  (no NestJS, no SDKs)  │  │
                                    │  └─┬────┬────┬────┬───────┘  │
                                    │    │    │    │    │          │
                                    │  ports (interfaces only)     │
                                    │    │    │    │    │          │
                                    │  ┌─▼─┐ ┌▼──┐ ┌▼──┐ ┌▼──┐     │
                                    │  │INF│ │STO│ │EXE│ │IDN│     │
                                    │  └─┬─┘ └─┬─┘ └─┬─┘ └─┬─┘     │
                                    └────┼─────┼─────┼─────┼───────┘
                                         │     │     │     │
                                  ┌──────▼─┐  ┌▼───┐ ┌▼───┐ ┌▼───┐
                                  │OgCompu │  │OgSt│ │Dire│ │Read│
                                  │teAdapt │  │orag│ │ctTx│ │only│
                                  │ +Replay│  │e   │ │    │ │ENS │
                                  └────┬───┘  └─┬──┘ └─┬──┘ └────┘
                                       │        │      │
                                       ▼        ▼      ▼
                                 ┌──────────┐  ┌────┐ ┌──────────┐
                                 │ 0G       │  │ 0G │ │ apps/api │
                                 │ Compute  │  │Stor│ │ /panel-  │
                                 │ broker   │  │age │ │ callback │
                                 └──────────┘  └────┘ └──────────┘
```

## Hexagonal contract

The domain core in `apps/panel/src/domain/` imports nothing from NestJS, nothing from Prisma, nothing from any 0G SDK. It depends only on the port interfaces in `apps/panel/src/domain/ports/`. Adapters live in `apps/panel/src/adapters/**` and are interchangeable per profile via `apps/panel/src/infrastructure/di/adapters.ts`.

Profile → adapter set:

| Profile  | Inference                                                                                         | Storage                                        | Execution                 | Identity                |
| -------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------- | ----------------------- |
| `test`   | `StubLlmAdapter`                                                                                  | `MemoryStorageAdapter`                         | `LogOnlyExecutionAdapter` | `MemoryIdentityAdapter` |
| `replay` | `ReplayAdapter(OgComputeAdapter \| StubLlmAdapter, frozen=false)`                                 | `OgStorageAdapter \| FilesystemStorageAdapter` | `DirectTxAdapter`         | `ReadonlyEnsAdapter`    |
| `demo`   | `ReplayAdapter(..., frozen=true)`                                                                 | `OgStorageAdapter \| FilesystemStorageAdapter` | `DirectTxAdapter`         | `ReadonlyEnsAdapter`    |
| `local`  | `ReplayAdapter(OgComputeAdapter, frozen=false)` (writes through to live 0G + caches the response) | `OgStorageAdapter`                             | `DirectTxAdapter`         | `ReadonlyEnsAdapter`    |

The same `AdjudicationService` runs in every profile; only the wiring changes.

## Communication

- `apps/api` → `apps/panel`: `POST /adjudicate` with `{ disputeId, evidenceBundle }`. Fire-and-forget; panel returns 202.
- `apps/panel` → `apps/api`: three callback endpoints — `/panel-callback/vote-update`, `/panel-callback/verdict`, `/panel-callback/settlement-step`. Each is gated by `x-tribune-panel-secret`.
- `apps/api` keeps the SSE stream to the frontend untouched. Panel callbacks update Postgres and emit on `EventEmitter2`; the existing `DisputeStreamController` relays them to the browser.

## Demo determinism

`ReplayAdapter` hashes `(modelName + systemPrompt + userPrompt + maxTokens + temperature)` to a fixture key under `apps/panel/fixtures/`. In `demo` profile (frozen), a cache miss throws — guaranteeing the demo doesn't make live LLM calls. Run `pnpm panel:record` in `replay` profile against a funded testnet account to populate fixtures.
