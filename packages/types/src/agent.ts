import { z } from 'zod';

export const AgentReputationSchema = z.object({
  ens: z.string().min(1),
  address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  disputesArbitrated: z.number().int().nonnegative(),
  upheldRate: z.number().min(0).max(1),
  score: z.number().min(0).max(1),
  updatedAt: z.coerce.date(),
});
export type AgentReputation = z.infer<typeof AgentReputationSchema>;
