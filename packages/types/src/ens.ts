import { z } from 'zod';

export const ENS_NAME_REGEX = /^[a-z0-9-]+(\.[a-z0-9-]+)+\.eth$/;

export const EnsName = z
  .string()
  .min(5, 'ENS name too short')
  .regex(ENS_NAME_REGEX, 'Must be a lowercase ENS name ending in .eth');
export type EnsName = z.infer<typeof EnsName>;
