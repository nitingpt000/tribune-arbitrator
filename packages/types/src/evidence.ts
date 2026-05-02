import { z } from 'zod';

export const EvidenceSchema = z.object({
  id: z.string().uuid(),
  disputeId: z.string().uuid(),
  submitter: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  uri: z.string().url(),
  contentHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'must be a 32-byte hex digest'),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const SubmitEvidenceInput = EvidenceSchema.pick({
  submitter: true,
  uri: true,
  contentHash: true,
});
export type SubmitEvidenceInput = z.infer<typeof SubmitEvidenceInput>;
