import { z } from 'zod';

export const StatsResponse = z.object({
  total: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
  settled: z.number().int().nonnegative(),
  refundedUsdc: z.number(),
  avgSettlementSeconds: z.number(),
  avgCostUsd: z.number(),
});
export type StatsResponse = z.infer<typeof StatsResponse>;
