# Sponsor developer-experience feedback (Phase 3 + Phase 4)

## KeeperHub MCP (Phase 4)

What we tried to do: submit `TribuneArbitrator.executeRuling(disputeId, ruling, bundleHash)` calldata to KeeperHub for guaranteed on-chain inclusion via the MCP server, then poll a job ID for the resulting tx hash.

Worked well:

- The "AI agent → MCP tool" framing maps cleanly onto our `ExecutionPort` adapter. We did not have to invent a new abstraction.
- A single `createKeeperRun` + `getKeeperRun` pair is enough for our use case.

Rough edges:

- The static landing page at `docs.keeperhub.com/` does not surface the _exact_ tool names, request bodies, and response shapes — it points to `/ai-tools/mcp-server` and `/api/direct-execution` but those subpages were not in the snapshot we pulled. We had to infer the shape and document it in `apps/panel/src/adapters/execution/keeperhub-mcp.client.ts`. Live verification is a TODO once we have an API key.
- 0G Chain is not in the documented supported-chains list (Ethereum, Base, Arbitrum, Polygon, Sepolia were named). We need a confirmation that KeeperHub will route Galileo testnet calldata, and if not, a clean fallback path. Our adapter falls back to the `DirectTxAdapter` (HTTP back to apps/api) but that's not "guaranteed inclusion" — it's panel signer issuing the tx.
- Job-status poll cadence is undocumented. We default to a 3 s poll inside the panel; that's a guess.

## 0G Galileo testnet contract layer (Phase 4)

What we tried: deploy `TribuneArbitrator` + `PanelRegistry` + `ExampleEscrow` to Galileo (chainId 16601), point the panel at it.

Rough edges:

- A canonical USDC address on Galileo isn't published in the testnet docs we read. We let `Deploy.s.sol` take `USDC_ADDRESS` as an env var and recommend deploying a `MockERC20` if there's no testnet USDC.
- Uniswap v3 router availability on Galileo is unclear. The settlement adapter accepts a `UNISWAP_ROUTER_ADDRESS` env var and silently no-ops when unset, so the rest of the dispute flow still works without cross-token settlement.
- ENS deployment on Galileo is unclear. The reputation adapter logs and skips writes when the resolver is unset; the apps/api reputation table remains authoritative until ENS is wired.

## Kleros ERC-792 (Phase 4)

What worked: the public Kleros contracts in `kleros/erc-792` — particularly `IArbitrable.sol`, `IArbitrator.sol`, `examples/SimpleEscrow.sol` — are _clean_. They compile under `^0.8.9`, have no implicit assumptions about the arbitrator's identity, and let us drop in `TribuneArbitrator` with literally a constructor argument change. This is exactly what a standard should look like.

Surprise: `IArbitrator.DisputeStatus` has three states (`Waiting`, `Appealable`, `Solved`) — even systems that don't support appeals must include the enum. We honour this in `TribuneArbitrator`.

Action item taken: vendored the Kleros SimpleEscrow and interfaces under `lib/erc-792-vendored/` and wrote a verbatim-deploy compat test in `test/KlerosCompat.t.sol`. All three flows pass. The gas snapshot is committed.

# 0G developer-experience feedback (Phase 3)

What this file is: concrete, non-snarky notes on what worked, what was missing, and what surprised us building Tribune's panel adjudication on top of 0G Compute and 0G Storage. Send these to 0G if useful.

## What worked well

- **OpenAI-compatible inference shape.** Once `getRequestHeaders()` mints the auth headers, the request body is plain `/v1/chat/completions`. Our `OgComputeAdapter` does not have to fork the prompt builder. This is the right abstraction.
- **Verifiable inference is a one-liner.** `broker.inference.processResponse(provider, content)` returns a boolean. We surface it as a structured attestation field on every panelist verdict and bubble `attestation_failed` as a typed `InferenceError`.
- **Native client-side encryption in the storage SDK.** AES-256 + ECIES are built in. We don't have to re-implement encryption to keep evidence private.
- **Two storage tiers (turbo / standard).** Useful for evidence (turbo) vs verdict bundles (standard could work).

## What was missing or rough

1. **The static URL `https://docs.0g.ai/compute` returns 404.** The actual compute docs are under `/developer-hub/building-on-0g/compute-network/`. Hackathon submissions waste time hunting.
2. **No published list of currently-live providers.** Pricing and model catalog rotate. We had to use `broker.inference.listService()` at runtime and pick "first three distinct families" — fine, but a cached "currently-live" list would let us hardcode panelist diversity at deploy time.
3. **Settlement is batched.** This is fine for production but during development a `getRealtimeBalance()` would short-circuit a class of "did I actually spend OG?" debugging questions.
4. **5 concurrent / 30 RPM is a real ceiling for fan-out workloads.** A 3-of-3 panel fits comfortably, but if someone wants to run 5 disputes in parallel they're already at 15 inference calls — at the edge of the per-user budget. The error response on rate-limit hits should be unambiguous (HTTP 429 with `Retry-After`).
5. **`@0glabs/0g-serving-broker` is marked deprecated on npm.** The replacement (`@0gfoundation/0g-serving-user-broker`?) isn't surfaced in the docs. We pinned to the existing release to avoid breakage but the migration path should be visible.
6. **Storage URI is just a merkle root hash.** The convention `0g://storage/<hash>` is ours; an official URI scheme would help interoperability between projects.
7. **Access control is "key-or-nothing".** We layer per-reader ECIES wrapping ourselves in `OgStorageAdapter`; an SDK-level helper for "encrypt-for-set-of-pubkeys" would save everyone reimplementing it.
8. **Verifiable inference attestation is binary (`processResponse → bool`).** A richer payload (TEE quote, model checkpoint hash, signing pubkey) would let us record a stronger artifact in the verdict bundle.
9. **Funding flow has implicit minima** (3 OG ledger, 1 OG per provider). If you forget to fund a sub-account, calls fail with a generic error that doesn't say "you're out of balance on provider X". Surfacing this is easy and would save real time.
10. **Storage SDK error messages.** `ZgFile.fromFilePath` errors out generically when running from non-Node contexts; the SDK could detect bundler/Vite and emit a targeted message pointing at the polyfill list.

## Suggestions

- Ship a `@0glabs/quickstart-panel` example that does exactly what we did: 3-model parallel call, evidence upload, verdict bundle. We would have built off it instead of working from docs.
- Publish a small SLA/cost dashboard at `pc.0g.ai` showing live provider latency and fee — this is what every team needs and what we'd write ourselves anyway.

## What we shipped despite the rough edges

A panel that:

- Calls 3 distinct LLMs in parallel via the broker
- Encrypts and persists evidence + verdict bundles to 0G Storage
- Surfaces TEE attestation on every panelist verdict
- Replays cached fixtures for demo determinism
- Maintains a strict hex architecture so the live integration is one adapter — Phase 4 swaps `DirectTxAdapter` for a KeeperHub adapter without touching the domain
