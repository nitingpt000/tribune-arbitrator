import type { IdentityPort } from '../../domain/ports/identity.port';
import type { DomainLogger } from '../../domain/ports/logger.port';
import type { AgentReputation, ReputationDelta } from '../../domain/types/identity';

/**
 * ENS reputation adapter.
 *
 * Writes Tribune reputation as ENS text records on the user's name (or on a
 * subname Tribune controls under tribune.eth). Read paths use the Public
 * Resolver. Write paths require the panel signer to own (or be authorised
 * over) the resolver entry — for user-owned ENS names we fall through to a
 * shadow record under <name>.tribune.eth which the panel signer does control.
 *
 * Live behaviour requires:
 *   - ENS Public Resolver address on the active chain
 *   - Tribune signer either owns tribune.eth or has setText approval there
 *
 * If neither is configured, writes are logged-only (Phase 4 falls back to the
 * Phase 3 Readonly behaviour and the reputation table in apps/api stays
 * authoritative).
 */

export interface EnsReputationAdapterOptions {
  rpcUrl: string;
  publicResolverAddress: string | null;
  ensRegistryAddress: string | null;
  signerKey: string | null;
  subnameSpace: string;
  logger: DomainLogger;
}

const TEXT_KEYS = {
  total: 'tribune.disputes.total',
  won: 'tribune.disputes.won',
  lost: 'tribune.disputes.lost',
  frivolity: 'tribune.frivolity.index',
  evidence: 'tribune.evidence.score',
  lastVerdict: 'tribune.last.verdict',
} as const;

export class EnsReputationIdentityAdapter implements IdentityPort {
  constructor(private readonly opts: EnsReputationAdapterOptions) {}

  async resolve(
    ens: string,
  ): Promise<{ ens: string; address?: string; reputation?: AgentReputation }> {
    if (!this.opts.publicResolverAddress) {
      return { ens };
    }
    const ethers = await import('ethers').catch(() => null);
    if (!ethers) return { ens };

    const provider = new ethers.JsonRpcProvider(this.opts.rpcUrl);
    try {
      const resolver = new ethers.Contract(
        this.opts.publicResolverAddress,
        ['function text(bytes32 node, string key) view returns (string)'],
        provider,
      ) as unknown as { text(node: string, key: string): Promise<string> };
      const node = ethers.namehash(ens);
      const [total, won, lost] = await Promise.all([
        resolver.text(node, TEXT_KEYS.total),
        resolver.text(node, TEXT_KEYS.won),
        resolver.text(node, TEXT_KEYS.lost),
      ]);
      const reputation: AgentReputation = {
        ens,
        totalDisputes: parseSafe(total),
        disputesWon: parseSafe(won),
        disputesLost: parseSafe(lost),
      };
      return { ens, reputation };
    } catch (err) {
      this.opts.logger.warn('ens.resolve_failed', {
        ens,
        error: (err as Error).message,
      });
      return { ens };
    }
  }

  async writeReputation(ens: string, delta: ReputationDelta): Promise<void> {
    if (!this.opts.publicResolverAddress || !this.opts.signerKey) {
      this.opts.logger.info('ens.write.deferred', {
        ens,
        delta,
        reason: 'public resolver or signer key not configured',
      });
      return;
    }

    const ethers = await import('ethers').catch(() => null);
    if (!ethers) {
      this.opts.logger.warn('ens.write.ethers_missing');
      return;
    }

    const provider = new ethers.JsonRpcProvider(this.opts.rpcUrl);
    const signer = new ethers.Wallet(this.opts.signerKey, provider);
    const resolver = new ethers.Contract(
      this.opts.publicResolverAddress,
      [
        'function text(bytes32 node, string key) view returns (string)',
        'function setText(bytes32 node, string key, string value) external',
      ],
      signer,
    ) as unknown as {
      text(node: string, key: string): Promise<string>;
      setText(node: string, key: string, value: string): Promise<{ hash: string }>;
    };

    const targetName = ens.endsWith(`.${this.opts.subnameSpace}`)
      ? ens
      : `${ens.split('.').slice(0, -1).join('.')}.${this.opts.subnameSpace}`;
    const node = ethers.namehash(targetName);

    const lastVerdict = delta.verdictBundleUri;
    const totalKey = TEXT_KEYS.total;
    const winsKey = TEXT_KEYS.won;
    const lossKey = TEXT_KEYS.lost;

    try {
      const [oldTotal, oldWins, oldLoss] = await Promise.all([
        resolver.text(node, totalKey),
        resolver.text(node, winsKey),
        resolver.text(node, lossKey),
      ]);
      const newTotal = parseSafe(oldTotal) + 1;
      const newWins = parseSafe(oldWins) + (delta.outcome === 'won' ? 1 : 0);
      const newLoss = parseSafe(oldLoss) + (delta.outcome === 'lost' ? 1 : 0);

      const txs = await Promise.all([
        resolver.setText(node, totalKey, String(newTotal)),
        resolver.setText(node, winsKey, String(newWins)),
        resolver.setText(node, lossKey, String(newLoss)),
        resolver.setText(node, TEXT_KEYS.lastVerdict, lastVerdict),
      ]);
      const txHashes = txs.map((t) => t.hash);
      this.opts.logger.info('ens.write.submitted', {
        ens: targetName,
        txHashes,
        newTotal,
        newWins,
        newLoss,
      });
    } catch (err) {
      this.opts.logger.warn('ens.write_failed', {
        ens,
        error: (err as Error).message,
      });
    }
  }
}

function parseSafe(s: string | null | undefined): number {
  const n = Number(s ?? '0');
  return Number.isFinite(n) ? n : 0;
}
