import { z } from 'zod';

export const DisputeStatus = z.enum(['PENDING', 'ADJUDICATING', 'SETTLED', 'REJECTED']);
export type DisputeStatus = z.infer<typeof DisputeStatus>;

export const PanelVoteChoice = z.enum(['REFUND', 'REJECT', 'ABSTAIN']);
export type PanelVoteChoice = z.infer<typeof PanelVoteChoice>;

export const PanelVoteStatus = z.enum(['PENDING', 'REASONING', 'VOTED', 'FAILED']);
export type PanelVoteStatus = z.infer<typeof PanelVoteStatus>;

export const SettlementStepType = z.enum([
  'VERDICT_ONCHAIN',
  'KEEPER_CLAIMED',
  'FUNDS_RELEASED',
  'ENS_REPUTATION',
]);
export type SettlementStepType = z.infer<typeof SettlementStepType>;

export const SettlementStepStatus = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED']);
export type SettlementStepStatus = z.infer<typeof SettlementStepStatus>;

export const ClaimType = z.enum([
  'service_not_delivered',
  'sla_breach',
  'wrong_amount',
  'data_breach',
  'misrepresentation',
  'other',
]);
export type ClaimType = z.infer<typeof ClaimType>;

export const PANELIST_MODELS = ['qwen3.6-plus', 'glm-5-fp8', 'llama-4-70b'] as const;
export type PanelistModelName = (typeof PANELIST_MODELS)[number];
