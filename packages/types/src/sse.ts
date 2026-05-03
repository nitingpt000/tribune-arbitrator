import { z } from 'zod';

import { DisputeStatus } from './enums.js';
import { PanelVoteSchema } from './panel-vote.js';
import { SettlementStepSchema } from './settlement-step.js';
import { VerdictSchema } from './verdict.js';

export const VoteUpdateEvent = z.object({
  type: z.literal('vote.update'),
  disputeId: z.string().uuid(),
  panelVote: PanelVoteSchema,
});
export type VoteUpdateEvent = z.infer<typeof VoteUpdateEvent>;

export const DisputeStatusEvent = z.object({
  type: z.literal('dispute.status'),
  disputeId: z.string().uuid(),
  status: DisputeStatus,
});
export type DisputeStatusEvent = z.infer<typeof DisputeStatusEvent>;

export const SettlementStepEvent = z.object({
  type: z.literal('settlement.step'),
  disputeId: z.string().uuid(),
  settlementStep: SettlementStepSchema,
});
export type SettlementStepEvent = z.infer<typeof SettlementStepEvent>;

export const VerdictCreatedEvent = z.object({
  type: z.literal('verdict.created'),
  disputeId: z.string().uuid(),
  verdict: VerdictSchema,
});
export type VerdictCreatedEvent = z.infer<typeof VerdictCreatedEvent>;

export const DisputeStreamEvent = z.discriminatedUnion('type', [
  VoteUpdateEvent,
  DisputeStatusEvent,
  SettlementStepEvent,
  VerdictCreatedEvent,
]);
export type DisputeStreamEvent = z.infer<typeof DisputeStreamEvent>;

export const SSE_EVENT_NAMES = [
  'vote.update',
  'dispute.status',
  'settlement.step',
  'verdict.created',
] as const;
export type SSEEventName = (typeof SSE_EVENT_NAMES)[number];
