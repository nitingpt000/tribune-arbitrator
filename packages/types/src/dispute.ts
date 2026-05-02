import { z } from 'zod';

export const DisputeStatus = z.enum(['pending', 'in_review', 'resolved', 'cancelled']);
export type DisputeStatus = z.infer<typeof DisputeStatus>;

export const DisputeSchema = z.object({
  id: z.string().uuid(),
  arbitrable: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'must be a checksummed EVM address'),
  externalDisputeId: z.string().min(1),
  choices: z.number().int().positive(),
  metadataUri: z.string().url().optional(),
  status: DisputeStatus,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Dispute = z.infer<typeof DisputeSchema>;

export const CreateDisputeInput = DisputeSchema.pick({
  arbitrable: true,
  externalDisputeId: true,
  choices: true,
  metadataUri: true,
});
export type CreateDisputeInput = z.infer<typeof CreateDisputeInput>;
