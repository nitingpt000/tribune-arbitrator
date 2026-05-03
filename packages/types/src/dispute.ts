import { z } from 'zod';

import { ClaimType, DisputeStatus } from './enums.js';
import { EnsName } from './ens.js';
import { EvidenceSchema } from './evidence.js';
import { PanelVoteSchema } from './panel-vote.js';
import { SettlementStepSchema } from './settlement-step.js';
import { VerdictSchema } from './verdict.js';

export const DisputeSchema = z.object({
  id: z.string().uuid(),
  status: DisputeStatus,
  claimantEns: EnsName,
  respondentEns: EnsName,
  claimType: z.string(),
  statement: z.string(),
  txHash: z.string(),
  amountUsdc: z.number(),
  arbitrationFee: z.number(),
  evidence: z.array(EvidenceSchema),
  panelVotes: z.array(PanelVoteSchema),
  verdict: VerdictSchema.nullable(),
  settlementSteps: z.array(SettlementStepSchema),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Dispute = z.infer<typeof DisputeSchema>;

export const DisputeSummarySchema = z.object({
  id: z.string().uuid(),
  status: DisputeStatus,
  claimantEns: EnsName,
  respondentEns: EnsName,
  claimType: z.string(),
  statement: z.string(),
  amountUsdc: z.number(),
  txHash: z.string(),
  evidenceCount: z.number().int().nonnegative(),
  votesCastCount: z.number().int().nonnegative(),
  verdict: VerdictSchema.nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type DisputeSummary = z.infer<typeof DisputeSummarySchema>;

export const DisputeListResponse = z.object({
  disputes: z.array(DisputeSummarySchema),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});
export type DisputeListResponse = z.infer<typeof DisputeListResponse>;

export const CreateDisputeInput = z.object({
  claimantEns: EnsName,
  respondentEns: EnsName,
  claimType: ClaimType,
  statement: z.string().min(20).max(2000),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Must be a 0x-prefixed 32-byte tx hash'),
  amountUsdc: z.number().positive().max(1_000_000),
});
export type CreateDisputeInput = z.infer<typeof CreateDisputeInput>;

export const DisputeListQuery = z.object({
  status: DisputeStatus.optional(),
  claimantEns: EnsName.optional(),
  respondentEns: EnsName.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export type DisputeListQuery = z.infer<typeof DisputeListQuery>;
