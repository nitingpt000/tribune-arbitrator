# Phase 3 Day-1 Spike

Goal of the spike: confirm before any production code that 0G Compute and 0G Storage on testnet can support a 3-model panel adjudication and a small encrypted evidence bundle, end-to-end, in our latency / cost budget.

This file is the source of truth for what we know about the 0G stack as of the start of Phase 3, what we still need to verify against a live testnet, and any blockers for the live profile.

> Last updated: Phase 3, Day 1.
> Sources cited inline with links.

## Summary

| Question                                               | Answer                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Is the broker SDK published, current, and pre-Phase-3? | Yes: `@0glabs/0g-serving-broker`, browser+node, OpenAI-compatible request shape. ([npm](https://www.npmjs.com/package/@0glabs/0g-serving-broker))                                                                                                                                                                                          |
| Is the storage SDK published and current?              | Yes: `@0gfoundation/0g-storage-ts-sdk`, with `Indexer` + `MemData` upload/download. ([npm](https://www.npmjs.com/package/@0glabs/0g-ts-sdk))                                                                                                                                                                                               |
| Are 3 distinct LLM model families live on testnet?     | Yes (documented at the time of writing): at least Llama-3.3-70B-Instruct + DeepSeek-R1-70B + an additional provider catalog discoverable via `broker.inference.listService()`. The exact set rotates per provider; we resolve at runtime. ([0G inference docs](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/inference)) |
| Verifiable inference?                                  | Yes: TeeML (model in TEE, response signed by TEE key) **or** TeeTLS (broker in TEE, signs hash of TLS-fetched response). `broker.inference.processResponse()` verifies.                                                                                                                                                                    |
| Concurrent calls supported?                            | Yes. Per-user limit is 5 concurrent requests; 30 RPM sustained. A 3-of-3 panel in `Promise.all` fits inside this budget.                                                                                                                                                                                                                   |
| Encryption story for evidence?                         | Native client-side AES-256 + ECIES (secp256k1) supported in the storage SDK. Wrap a per-bundle AES key under each authorised reader's secp256k1 pubkey.                                                                                                                                                                                    |
| Funding flow?                                          | Testnet OG via standard L1 RPC (`https://evmrpc-testnet.0g.ai`, chainId 16601). `broker.ledger.depositFund()` with ≥ **3 OG** for ledger creation, plus **1 OG per provider** sub-account. Settlement is **batched on-chain**; balances appear inflated until settlement.                                                                  |
| Per-call cost?                                         | Per-provider, dynamic. Documented hint: ~10,000 inference requests per 0.1 OG on the cheapest providers. We will refine after the live spike.                                                                                                                                                                                              |

**Verdict on the spike:** The architecture is feasible against documented SDK behaviour. There is no blocker that demands a fallback to OpenAI. The remaining unknowns are operational (live latency, exact provider pricing today) and require a funded testnet account; see § Live verification below.

## Compute (`@0glabs/0g-serving-broker`)

```bash
npm install @0glabs/0g-serving-broker
```

Initialisation:

```ts
import { ethers } from 'ethers';
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';

const provider = new ethers.JsonRpcProvider('https://evmrpc-testnet.0g.ai');
const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const broker = await createZGComputeNetworkBroker(signer);

// One-time per ledger
await broker.ledger.addLedger(ethers.parseEther('3'));

// One-time per provider sub-account (the example below funds with 1 OG)
const services = await broker.inference.listService();
for (const s of services) {
  await broker.ledger.transferFund(s.provider, 'inference', ethers.parseEther('1'));
}
```

Inference call (OpenAI-compatible):

```ts
const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress);
const headers = await broker.inference.getRequestHeaders(providerAddress, prompt);

const response = await fetch(`${endpoint}/v1/chat/completions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 512,
    temperature: 0.2,
  }),
});

const json = await response.json();
const trustworthy = await broker.inference.processResponse(
  providerAddress,
  json.choices[0].message.content,
);
```

Key facts:

- The broker speaks **OpenAI-compatible** request bodies once you have the endpoint + headers. We will not fork our prompt-builder for it.
- `processResponse()` returns a boolean; we should record this in our `Verdict` bundle as the verifiability flag and bubble a non-trustworthy response up as `InferenceError` with code `attestation_failed`.
- Settlement is **batched** — do not assume your balance shows real-time deductions.
- **5 concurrent requests / 30 RPM** rate budget is fine for a 3-of-3 panel but means we cannot fan out 10 disputes simultaneously without queueing. For the demo's flow this is a non-issue.
- TeeML vs TeeTLS depends on the provider; the broker abstracts the difference.

## Storage (`@0gfoundation/0g-storage-ts-sdk`)

```bash
npm install @0gfoundation/0g-storage-ts-sdk ethers
```

Upload + download a small JSON blob:

```ts
import { Indexer, MemData } from '@0gfoundation/0g-storage-ts-sdk';

const indexer = new Indexer('https://indexer-storage-testnet-turbo.0g.ai');
const blob = new MemData(new TextEncoder().encode(JSON.stringify(payload)));
const [tree] = await blob.merkleTree();
const [tx] = await indexer.upload(blob, 'https://evmrpc-testnet.0g.ai', signer);
const rootHash = tree.rootHash();

// Later
const [downloaded] = await indexer.downloadToBlob(rootHash);
```

Key facts:

- **Encryption is native:** the SDK supports AES-256 (32-byte symmetric key, 17-byte header) **and** ECIES (secp256k1, 50-byte header) client-side. The plaintext never reaches a 0G node.
- **Access control is key-based, not ACL.** There is no native "list of authorised ENS readers". Our `StoragePort.put({ accessControl: { authorizedReaders } })` will be implemented by:
  1. Generate a random AES-256 key per upload.
  2. Encrypt the bundle under that key.
  3. Resolve each `authorizedReaders` entry to a secp256k1 public key (ENS → eth_address → known signing pubkey, or the pubkey directly).
  4. Wrap the AES key under each reader's pubkey via ECIES.
  5. Store the wrapped-key set as a small companion blob. The returned URI is `0g://storage/<rootHash>?keys=<companionRootHash>`.
- **Two indexer tiers:** `turbo` (faster, higher fee) and `standard`. We use turbo.
- **Latency is not documented**; live spike measures it.

## Live verification (requires funded testnet account)

The `apps/panel/spike/three-models-parallel.ts` script in this folder is the throwaway from the spec. It does not run automatically; the developer runs it once to validate the live profile:

```bash
export PANEL_PRIVATE_KEY=0x...               # funded testnet account (≥ 5 OG total recommended)
pnpm --filter @tribune/panel exec tsx spike/three-models-parallel.ts
```

What the script reports:

1. The catalog of providers/models live on the network at this moment.
2. Wall-clock latency for one request to each of the first three available models.
3. p50/p95 over 5 sequential calls per model.
4. Wall-clock total for the 3 models in parallel (the relevant number for adjudication).
5. Estimated cost in OG and (with `OG_USD_RATE`) USD per dispute.
6. Whether `processResponse()` returned `true` for each call (attestation sanity check).

Exit code is non-zero if fewer than 3 models respond successfully. **If the script fails, stop and discuss before deploying the `local` profile.**

## Decisions taken before any code was written

1. The domain and ports stay strict. Both 0G SDKs and ethers are imported only from `apps/panel/src/adapters/**`.
2. `OgComputeAdapter` resolves the model catalog dynamically via `listService()` — we do not hardcode model names or provider addresses, because both rotate.
3. `OgStorageAdapter` implements the per-reader ECIES wrapping described above on top of the SDK's native encryption.
4. The `ReplayAdapter` is the only thing CI ever runs against; live adapters require an explicit `APP_PROFILE=local` and a funded key. CI uses `APP_PROFILE=test`, which never imports the SDKs.
5. Failed `processResponse()` is **not** silent — it surfaces as `InferenceError(code: 'attestation_failed')` and that panelist's vote is `FAILED`. The Verdict bundle records the attestation result for every panelist.

## Open items for the live spike (the user must run)

- [ ] Run `apps/panel/spike/three-models-parallel.ts` against a funded testnet account.
- [ ] Confirm at least 3 distinct providers (preferably distinct model families) succeed.
- [ ] Record a baseline panel cost (OG + USD) and append it here.
- [ ] If `processResponse()` ever returns `false` on a known-good prompt, file an issue against the broker repo and link it here.
- [ ] If turbo storage upload exceeds 10s p95 for a 10 KB blob, document and reconsider the bundle format.

## What this means for the build

- Day 1: this document + the throwaway script exist.
- Day 2 onwards: full hex-architecture build with stub/replay adapters that pass all unit tests, and 0G adapters written against the documented SDK API. The build does **not** block on live verification — the user can validate the live profile separately and the stub/replay flow keeps the demo recordable.
