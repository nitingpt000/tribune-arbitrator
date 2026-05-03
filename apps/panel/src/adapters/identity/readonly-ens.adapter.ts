import type { IdentityPort } from '../../domain/ports/identity.port';
import type { DomainLogger } from '../../domain/ports/logger.port';
import type { AgentReputation, ReputationDelta } from '../../domain/types/identity';

/**
 * Phase 3 read-only adapter:
 * - resolve() returns the ENS unchanged. Phase 4 wires real ENS resolution.
 * - writeReputation() logs the intent but does not write on chain. Phase 4 (KeeperHub)
 *   replaces this with the real text-record write.
 */
export class ReadonlyEnsAdapter implements IdentityPort {
  constructor(private readonly logger: DomainLogger) {}

  async resolve(
    ens: string,
  ): Promise<{ ens: string; address?: string; reputation?: AgentReputation }> {
    return { ens };
  }

  async writeReputation(ens: string, delta: ReputationDelta): Promise<void> {
    this.logger.info('identity.writeReputation.deferred', {
      ens,
      delta,
      note: 'phase 3 read-only — KeeperHub wires this in phase 4',
    });
  }
}
