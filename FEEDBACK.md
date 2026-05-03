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
