import { z } from 'zod';

export const VerdictSchema = z.object({
  id: z.string().uuid(),
  disputeId: z.string().uuid(),
  ruling: z.number().int().nonnegative(),
  rationale: z.string().min(1),
  signedBy: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Verdict = z.infer<typeof VerdictSchema>;
