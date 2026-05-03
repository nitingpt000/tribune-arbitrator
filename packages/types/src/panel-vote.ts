import { z } from 'zod';

import { PanelVoteChoice, PanelVoteStatus } from './enums.js';

export const PanelVoteSchema = z.object({
  id: z.string().uuid(),
  disputeId: z.string().uuid(),
  modelName: z.string(),
  vote: PanelVoteChoice,
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  status: PanelVoteStatus,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type PanelVote = z.infer<typeof PanelVoteSchema>;
