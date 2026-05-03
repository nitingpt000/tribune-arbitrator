import type {
  InferenceCall,
  InferencePort,
  InferenceResult,
} from '../../domain/ports/inference.port';

// These names match apps/api's seeded `PanelVote.modelName` rows so that the
// callback upserts hit the right rows in the test/demo profile.
const FAMILIES = ['qwen3.6-plus', 'glm-5-fp8', 'llama-4-70b'] as const;

const REASONING_LIB: Record<string, [string, string]> = {
  service_not_delivered: [
    'Output does not satisfy the SOW; refund per article 3.',
    'Buyer accepted partial delivery in writing 24h before filing; reject.',
  ],
  sla_breach: [
    'Logs show producer-side misses beyond the SLA cap; refund pro-rata.',
    'Probe samples a maintenance window the SLA excludes; reject.',
  ],
  wrong_amount: [
    'Block-explorer trace shows a single transfer; reject.',
    'On-chain transfer overcharges by the documented delta; refund.',
  ],
  data_breach: [
    'Vendor failed to revoke at the agreed cadence; refund damages.',
    'Buyer\u2019s key was used to fetch the dataset; reject.',
  ],
  misrepresentation: [
    'Provenance metadata diverges from the agreed checkpoint; refund.',
    'Findings were out of agreed scope; reject.',
  ],
  other: [
    'The contract\u2019s acceptance criteria are not met; refund.',
    'No breach of a binding clause is established; reject.',
  ],
};

export class StubLlmAdapter implements InferencePort {
  async listAvailableModels(): Promise<string[]> {
    return [...FAMILIES];
  }

  async runPanelist(input: InferenceCall): Promise<InferenceResult> {
    const start = Date.now();
    const claimType = extractClaimType(input.userPrompt);
    const seed = stableHash(`${input.modelName}|${input.userPrompt}`);
    const refundFavoured = seed % 10 < 7;
    const family = REASONING_LIB[claimType] ?? REASONING_LIB.other ?? ['', ''];
    const reasoning = (refundFavoured ? family[0] : family[1]) ?? 'evidence reviewed';
    const vote = refundFavoured ? 'REFUND' : 'REJECT';
    const confidence = 0.7 + ((seed >>> 8) % 25) / 100;
    const json = JSON.stringify({
      vote,
      confidence: Number(confidence.toFixed(2)),
      reasoning,
    });
    return {
      rawResponse: json,
      promptTokens: 220,
      completionTokens: 64,
      latencyMs: Math.max(1, Date.now() - start),
      attestation: 'stub:trusted',
    };
  }
}

function extractClaimType(userPrompt: string): string {
  const m = userPrompt.match(/Claim type: ([a-z_]+)/);
  return m?.[1] ?? 'other';
}

function stableHash(input: string): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
