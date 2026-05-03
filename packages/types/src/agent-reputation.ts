import { z } from 'zod';

import { EnsName } from './ens.js';

export const AgentReputationSchema = z.object({
  ens: EnsName,
  totalDisputes: z.number().int().nonnegative(),
  disputesWon: z.number().int().nonnegative(),
  disputesLost: z.number().int().nonnegative(),
  frivolityIndex: z.number(),
  evidenceQualityScore: z.number(),
  lastVerdictId: z.string().uuid().nullable(),
  updatedAt: z.coerce.date(),
});
export type AgentReputation = z.infer<typeof AgentReputationSchema>;

export const AgentReputationDisputeRow = z.object({
  id: z.string().uuid(),
  status: z.string(),
  outcome: z.enum(['REFUND', 'REJECT', 'ABSTAIN']).nullable(),
  amountUsdc: z.number(),
  counterparty: EnsName,
  role: z.enum(['claimant', 'respondent']),
  closedAt: z.coerce.date().nullable(),
});
export type AgentReputationDisputeRow = z.infer<typeof AgentReputationDisputeRow>;

export const AgentReputationResponse = AgentReputationSchema.extend({
  recentDisputes: z.array(AgentReputationDisputeRow),
});
export type AgentReputationResponse = z.infer<typeof AgentReputationResponse>;
