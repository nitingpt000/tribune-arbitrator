import { z } from 'zod';

import { PanelVoteChoice } from './enums.js';

export const VerdictSchema = z.object({
  id: z.string().uuid(),
  disputeId: z.string().uuid(),
  outcome: PanelVoteChoice,
  votesFor: z.number().int().nonnegative(),
  votesAgainst: z.number().int().nonnegative(),
  totalDurationMs: z.number().int().nonnegative(),
  totalCostUsd: z.number(),
  createdAt: z.coerce.date(),
});
export type Verdict = z.infer<typeof VerdictSchema>;
