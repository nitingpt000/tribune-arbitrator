import { z } from 'zod';

import { SettlementStepStatus, SettlementStepType } from './enums.js';

export const SettlementStepSchema = z.object({
  id: z.string().uuid(),
  disputeId: z.string().uuid(),
  step: SettlementStepType,
  status: SettlementStepStatus,
  txHash: z.string().nullable(),
  detail: z.string().nullable(),
  startedAt: z.coerce.date().nullable(),
  completedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});
export type SettlementStep = z.infer<typeof SettlementStepSchema>;
