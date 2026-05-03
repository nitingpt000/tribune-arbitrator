import { z } from 'zod';

import type { VoteChoice } from './types/panel';

export const PanelistJsonSchema = z.object({
  vote: z.enum(['REFUND', 'REJECT', 'ABSTAIN']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1).max(280),
});

export type PanelistJson = z.infer<typeof PanelistJsonSchema>;

export interface ParsePanelistResponseResult {
  ok: true;
  vote: VoteChoice;
  confidence: number;
  reasoning: string;
}

export interface ParsePanelistResponseFailure {
  ok: false;
  errorCode: 'no_json' | 'invalid_json' | 'schema_mismatch';
  errorMessage: string;
}

export function parsePanelistResponse(
  raw: string,
): ParsePanelistResponseResult | ParsePanelistResponseFailure {
  const candidate = extractFirstJsonObject(raw);
  if (!candidate) {
    return {
      ok: false,
      errorCode: 'no_json',
      errorMessage: 'No JSON object found in response',
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (err) {
    return {
      ok: false,
      errorCode: 'invalid_json',
      errorMessage: err instanceof Error ? err.message : 'Invalid JSON',
    };
  }
  const validation = PanelistJsonSchema.safeParse(parsed);
  if (!validation.success) {
    return {
      ok: false,
      errorCode: 'schema_mismatch',
      errorMessage: validation.error.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; '),
    };
  }
  return {
    ok: true,
    vote: validation.data.vote,
    confidence: validation.data.confidence,
    reasoning: validation.data.reasoning.trim(),
  };
}

function extractFirstJsonObject(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }
  const start = raw.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\' && inString) {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null;
}
