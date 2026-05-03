import type { AgentReputation, ReputationDelta } from '../types/identity';

export interface IdentityPort {
  resolve(ens: string): Promise<{ ens: string; address?: string; reputation?: AgentReputation }>;
  writeReputation(ens: string, delta: ReputationDelta): Promise<void>;
}

export const IDENTITY_PORT = Symbol('IdentityPort');
