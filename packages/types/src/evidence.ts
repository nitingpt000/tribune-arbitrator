import { z } from 'zod';

export const EvidenceSchema = z.object({
  id: z.string().uuid(),
  disputeId: z.string().uuid(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  storageUri: z.string(),
  createdAt: z.coerce.date(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const AddEvidenceInput = z.object({
  filename: z.string().min(1).max(256),
  mimeType: z.string().min(1).max(128),
  sizeBytes: z
    .number()
    .int()
    .nonnegative()
    .max(50 * 1024 * 1024),
});
export type AddEvidenceInput = z.infer<typeof AddEvidenceInput>;
