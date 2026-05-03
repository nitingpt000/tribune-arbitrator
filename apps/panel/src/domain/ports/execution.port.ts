import type { SettlementStepType, VoteChoice } from '../types/panel';

export interface SubmitVerdictInput {
  disputeId: string;
  outcome: VoteChoice | 'FAILED';
  votesFor: number;
  votesAgainst: number;
  bundleUri: string;
  totalDurationMs: number;
  totalCostUsd: number;
}

export interface RecordSettlementStepInput {
  disputeId: string;
  step: SettlementStepType;
  txHash?: string;
  detail?: string;
  status?: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
}

export interface VoteUpdateInput {
  disputeId: string;
  modelName: string;
  status: 'REASONING' | 'VOTED' | 'FAILED';
  vote?: VoteChoice;
  confidence?: number;
  reasoning?: string;
}

export interface ExecutionPort {
  notifyVoteUpdate(input: VoteUpdateInput): Promise<void>;
  submitVerdict(input: SubmitVerdictInput): Promise<{ executionRef: string }>;
  recordSettlementStep(input: RecordSettlementStepInput): Promise<void>;
}

export const EXECUTION_PORT = Symbol('ExecutionPort');
