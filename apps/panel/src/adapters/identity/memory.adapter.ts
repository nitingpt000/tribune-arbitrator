import type { IdentityPort } from '../../domain/ports/identity.port';
import type { AgentReputation, ReputationDelta } from '../../domain/types/identity';

export class MemoryIdentityAdapter implements IdentityPort {
  readonly writes: Array<{ ens: string; delta: ReputationDelta }> = [];
  private readonly reputations = new Map<string, AgentReputation>();

  async resolve(
    ens: string,
  ): Promise<{ ens: string; address?: string; reputation?: AgentReputation }> {
    return { ens, reputation: this.reputations.get(ens) };
  }

  async writeReputation(ens: string, delta: ReputationDelta): Promise<void> {
    this.writes.push({ ens, delta });
    const existing =
      this.reputations.get(ens) ??
      ({ ens, totalDisputes: 0, disputesWon: 0, disputesLost: 0 } as AgentReputation);
    existing.totalDisputes += 1;
    if (delta.outcome === 'won') existing.disputesWon += 1;
    if (delta.outcome === 'lost') existing.disputesLost += 1;
    this.reputations.set(ens, existing);
  }
}
