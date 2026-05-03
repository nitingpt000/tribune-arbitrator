export type VoteChoice = 'REFUND' | 'REJECT' | 'ABSTAIN';
export type SettlementStepType =
  | 'VERDICT_ONCHAIN'
  | 'KEEPER_CLAIMED'
  | 'FUNDS_RELEASED'
  | 'ENS_REPUTATION';

export interface PanelMember {
  modelName: string;
  providerRef: string;
}

export interface PanelistVerdict {
  modelName: string;
  vote: VoteChoice;
  confidence: number;
  reasoning: string;
  status: 'VOTED' | 'FAILED';
  rawResponse: string;
  attestation: string | null;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  errorCode?: string;
  errorMessage?: string;
}

export type DisputeOutcome = 'REFUND' | 'REJECT' | 'ABSTAIN' | 'FAILED';

export interface Verdict {
  disputeId: string;
  outcome: DisputeOutcome;
  votesFor: number;
  votesAgainst: number;
  panelists: PanelistVerdict[];
  bundleUri: string;
  totalDurationMs: number;
  totalCostUsd: number;
  promptVersion: string;
  createdAtIso: string;
}

export interface VerdictBundle {
  schemaVersion: 1;
  promptVersion: string;
  disputeId: string;
  systemPrompt: string;
  userPromptTemplate: string;
  panelists: PanelistVerdict[];
  outcome: DisputeOutcome;
  votesFor: number;
  votesAgainst: number;
  decidedAtIso: string;
  totalDurationMs: number;
}
