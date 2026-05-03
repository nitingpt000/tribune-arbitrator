/**
 * Phase 3 Day-1 throwaway: hit 3 different 0G Compute models in parallel,
 * measure latency, surface cost, sanity-check verifiable-inference attestation.
 *
 * Run with a funded 0G Galileo testnet key:
 *   export PANEL_PRIVATE_KEY=0x...
 *   pnpm --filter @tribune/panel exec tsx spike/three-models-parallel.ts
 *
 * Exits non-zero if fewer than 3 distinct providers respond successfully.
 * Findings should be appended to apps/panel/SPIKE.md.
 */

import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';
import { ethers } from 'ethers';

const RPC_URL = process.env.OG_RPC_URL ?? 'https://evmrpc-testnet.0g.ai';
const PRIVATE_KEY = process.env.PANEL_PRIVATE_KEY;
const OG_USD_RATE = Number(process.env.OG_USD_RATE ?? '1');
const SAMPLE_PROMPT = [
  'You are a domain-impartial juror. Reply ONLY with the JSON object',
  '{"vote": "REFUND" | "REJECT", "confidence": <number 0-1>, "reasoning": "<= 280 chars"}.',
  'Dispute: buyer paid 1,250 USDC for a 7-entry forecast; seller delivered 3 entries. Vote.',
].join('\n');

interface PanelistResult {
  provider: string;
  model: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  attestationOk: boolean | null;
  rawSnippet: string;
  errored: boolean;
  error?: string;
}

async function main(): Promise<void> {
  if (!PRIVATE_KEY) {
    console.error('Set PANEL_PRIVATE_KEY (a funded 0G testnet account) before running.');
    process.exit(2);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);
  const broker = await createZGComputeNetworkBroker(signer);

  console.log('Listing inference services on the broker…');
  const services: Array<{ provider: string; serviceType: string; url?: string; model?: string }> =
    (await broker.inference.listService()) as Array<{
      provider: string;
      serviceType: string;
      url?: string;
      model?: string;
    }>;
  const inference = services.filter((s) => s.serviceType === 'inference');
  console.log(`Found ${inference.length} inference service(s).`);

  if (inference.length < 3) {
    console.error('Fewer than 3 inference services available on testnet. Cannot proceed.');
    process.exit(3);
  }

  const distinctModelPicks = pickThreeDistinctModels(inference);
  console.log('Selected providers for the panel:');
  for (const s of distinctModelPicks) {
    console.log(`  - provider=${s.provider} model=${s.model ?? '(unknown)'}`);
  }

  const totalStart = performance.now();
  const results = await Promise.all(distinctModelPicks.map((s) => callOne(broker, s.provider)));
  const totalMs = performance.now() - totalStart;

  console.log('\nResults:');
  for (const r of results) {
    if (r.errored) {
      console.log(`  ❌ provider=${r.provider} model=${r.model} error=${r.error}`);
    } else {
      console.log(
        `  ✅ provider=${r.provider} model=${r.model} latency=${r.latencyMs.toFixed(0)}ms ` +
          `tokens(in/out)=${r.promptTokens}/${r.completionTokens} ` +
          `attestation=${r.attestationOk ?? 'n/a'} sample="${r.rawSnippet.slice(0, 80)}"`,
      );
    }
  }
  const successes = results.filter((r) => !r.errored);
  const wallClockSec = (totalMs / 1000).toFixed(2);
  const slowestSec =
    successes.length > 0
      ? (Math.max(...successes.map((r) => r.latencyMs)) / 1000).toFixed(2)
      : 'n/a';
  console.log(`\nWall-clock total: ${wallClockSec}s`);
  console.log(`Slowest panelist: ${slowestSec}s (= the panel's effective latency)`);

  if (OG_USD_RATE) {
    const usdEstimate = (successes.length * 0.0001 * OG_USD_RATE).toFixed(4);
    console.log(`Cost estimate at OG_USD_RATE=${OG_USD_RATE}: ~$${usdEstimate} per panel call`);
  }

  if (successes.length < 3) {
    console.error(`\nOnly ${successes.length}/3 panelists succeeded. Failing the spike.`);
    process.exit(4);
  }
  console.log('\nSpike OK: 3 distinct providers responded.');
  process.exit(0);
}

function pickThreeDistinctModels(
  services: Array<{ provider: string; serviceType: string; model?: string }>,
): Array<{ provider: string; model?: string }> {
  const seen = new Set<string>();
  const picks: Array<{ provider: string; model?: string }> = [];
  for (const s of services) {
    const key = (s.model ?? s.provider).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    picks.push({ provider: s.provider, model: s.model });
    if (picks.length === 3) break;
  }
  if (picks.length < 3) {
    for (const s of services) {
      if (picks.find((p) => p.provider === s.provider)) continue;
      picks.push({ provider: s.provider, model: s.model });
      if (picks.length === 3) break;
    }
  }
  return picks;
}

async function callOne(
  broker: Awaited<ReturnType<typeof createZGComputeNetworkBroker>>,
  providerAddress: string,
): Promise<PanelistResult> {
  const start = performance.now();
  const result: PanelistResult = {
    provider: providerAddress,
    model: '(resolving)',
    latencyMs: 0,
    promptTokens: 0,
    completionTokens: 0,
    attestationOk: null,
    rawSnippet: '',
    errored: false,
  };
  try {
    const meta = (await broker.inference.getServiceMetadata(providerAddress)) as {
      endpoint: string;
      model: string;
    };
    result.model = meta.model;
    const headers = (await broker.inference.getRequestHeaders(
      providerAddress,
      SAMPLE_PROMPT,
    )) as unknown as Record<string, string>;
    const res = await fetch(`${meta.endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({
        model: meta.model,
        messages: [{ role: 'user', content: SAMPLE_PROMPT }],
        max_tokens: 256,
        temperature: 0.2,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = json.choices?.[0]?.message?.content ?? '';
    result.rawSnippet = content;
    result.promptTokens = json.usage?.prompt_tokens ?? 0;
    result.completionTokens = json.usage?.completion_tokens ?? 0;
    try {
      result.attestationOk = await broker.inference.processResponse(providerAddress, content);
    } catch {
      result.attestationOk = null;
    }
  } catch (err) {
    result.errored = true;
    result.error = err instanceof Error ? err.message : String(err);
  } finally {
    result.latencyMs = performance.now() - start;
  }
  return result;
}

void main().catch((err) => {
  console.error('Spike crashed:', err);
  process.exit(1);
});
