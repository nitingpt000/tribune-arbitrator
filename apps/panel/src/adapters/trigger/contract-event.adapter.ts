import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { AdjudicationService } from '../../domain/adjudication.service';
import type { DomainLogger } from '../../domain/ports/logger.port';
import type { EvidenceBundle } from '../../domain/types/evidence';

/**
 * Listens for ERC-792 `DisputeCreation` events emitted by `TribuneArbitrator`
 * on 0G Chain, builds an `EvidenceBundle` from the calling Arbitrable contract,
 * and triggers the domain `AdjudicationService`.
 *
 * Strategy:
 *  - Use ethers v6 `provider.on()` for live subscription.
 *  - Catch up periodically via `getLogs()` from `lastSeenBlock` so we never
 *    miss an event during a brief disconnect.
 *  - Persist `lastSeenBlock` to disk under `PANEL_FIXTURES_DIR/trigger-state.json`
 *    so a restart doesn't re-trigger past disputes.
 *
 * Live behaviour requires a funded PANEL_PRIVATE_KEY and a deployed arbitrator
 * — see apps/panel/SPIKE.md and packages/contracts/README.md for setup.
 */

export interface ContractEventAdapterOptions {
  rpcUrl: string;
  arbitratorAddress: string;
  exampleEscrowAddress: string | null;
  startBlock: number;
  stateDir: string;
  pollIntervalMs?: number;
  adjudication: AdjudicationService;
  logger: DomainLogger;
}

interface PersistedState {
  lastSeenBlock: number;
}

const ARBITRATOR_TOPIC_DISPUTE_CREATION =
  '0x141dfc18aa6a56fc816f44f0e9e2f1ebc92b15ab167770e17db5b084c10ed995';
//  ^ keccak256("DisputeCreation(uint256,address)") — recompute if interface changes.

const ESCROW_TOPIC_DISPUTED = '0xd4a6ef3a2d26f54fa6ef6ab9a8ff08a5e2c6efa7f5b76a4f2f41bd3a7a3c7ad6';
//  ^ keccak256("TransactionDisputed(uint256,uint256,string)") — recompute as needed.

export class ContractEventTriggerAdapter {
  private running = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private subscription: { unsubscribe(): void } | null = null;
  private lastSeenBlock: number;

  constructor(private readonly opts: ContractEventAdapterOptions) {
    this.lastSeenBlock = opts.startBlock;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    await this.loadState();

    const ethers = await import('ethers').catch(() => null);
    if (!ethers) {
      this.opts.logger.warn('contract-event.ethers_missing', {
        message: 'install ethers to use the live trigger',
      });
      return;
    }

    const provider = new ethers.JsonRpcProvider(this.opts.rpcUrl);

    // Live subscription
    try {
      const filter = {
        address: this.opts.arbitratorAddress,
        topics: [ARBITRATOR_TOPIC_DISPUTE_CREATION],
      };
      const handler = (log: {
        blockNumber: number;
        topics: ReadonlyArray<string>;
        data: string;
      }): void => {
        void this.handleLog(log);
      };
      provider.on(filter, handler);
      this.subscription = {
        unsubscribe: () => {
          provider.off(filter, handler);
        },
      };
      this.opts.logger.info('contract-event.subscribed', {
        arbitrator: this.opts.arbitratorAddress,
        startBlock: this.lastSeenBlock,
      });
    } catch (err) {
      this.opts.logger.warn('contract-event.subscription_failed', {
        error: (err as Error).message,
      });
    }

    // Catchup poller
    const interval = this.opts.pollIntervalMs ?? 3_000;
    this.timer = setInterval(() => {
      void this.catchup(provider).catch((err: unknown) => {
        this.opts.logger.warn('contract-event.catchup_failed', {
          error: (err as Error).message,
        });
      });
    }, interval);
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.subscription?.unsubscribe();
    this.subscription = null;
    await this.persistState();
  }

  private async catchup(provider: {
    getBlockNumber(): Promise<number>;
    getLogs(filter: unknown): Promise<unknown[]>;
  }): Promise<void> {
    const head = await provider.getBlockNumber();
    if (head <= this.lastSeenBlock) return;
    const logs = (await provider.getLogs({
      address: this.opts.arbitratorAddress,
      topics: [ARBITRATOR_TOPIC_DISPUTE_CREATION],
      fromBlock: this.lastSeenBlock + 1,
      toBlock: head,
    })) as Array<{ blockNumber: number; topics: ReadonlyArray<string>; data: string }>;
    for (const log of logs) {
      await this.handleLog(log);
    }
    this.lastSeenBlock = head;
    await this.persistState();
  }

  private async handleLog(log: {
    blockNumber: number;
    topics: ReadonlyArray<string>;
    data: string;
  }): Promise<void> {
    if (log.blockNumber <= this.lastSeenBlock) return;
    const disputeIDHex = log.topics[1];
    if (!disputeIDHex) return;
    const disputeID = BigInt(disputeIDHex).toString();
    this.opts.logger.info('contract-event.dispute_created', {
      disputeID,
      block: log.blockNumber,
    });
    const bundle = await this.buildBundle(disputeID, log).catch((err: unknown) => {
      this.opts.logger.warn('contract-event.bundle_failed', {
        disputeID,
        error: (err as Error).message,
      });
      return null;
    });
    if (!bundle) return;
    await this.opts.adjudication.adjudicate({ disputeId: disputeID, evidenceBundle: bundle });
    this.lastSeenBlock = log.blockNumber;
    await this.persistState();
  }

  private async buildBundle(disputeID: string, _log: unknown): Promise<EvidenceBundle> {
    // Phase 4: in production this reads ExampleEscrow.transactions(arbitratorToTxId[id])
    // and the latest TransactionDisputed Evidence event for the URI. For now we
    // emit a minimal bundle so the panel can adjudicate; the indexer in apps/api
    // hydrates the rich record on the API side.
    return {
      disputeId: disputeID,
      claimType: 'other',
      statement: `On-chain dispute ${disputeID} from ${this.opts.arbitratorAddress}`,
      claimantEns: 'unknown.eth',
      respondentEns: 'unknown.eth',
      txHash: `0x${'0'.repeat(64)}`,
      amountUsdc: 0,
      files: [],
    };
  }

  private get statePath(): string {
    return path.join(this.opts.stateDir, 'trigger-state.json');
  }

  private async loadState(): Promise<void> {
    try {
      const body = await fs.readFile(this.statePath, 'utf8');
      const parsed = JSON.parse(body) as PersistedState;
      if (typeof parsed.lastSeenBlock === 'number') {
        this.lastSeenBlock = Math.max(this.lastSeenBlock, parsed.lastSeenBlock);
      }
    } catch {
      // first run; keep startBlock
    }
  }

  private async persistState(): Promise<void> {
    try {
      await fs.mkdir(this.opts.stateDir, { recursive: true });
      const body: PersistedState = { lastSeenBlock: this.lastSeenBlock };
      await fs.writeFile(this.statePath, JSON.stringify(body, null, 2));
    } catch (err) {
      this.opts.logger.warn('contract-event.persist_failed', {
        error: (err as Error).message,
      });
    }
  }
}

void ESCROW_TOPIC_DISPUTED;
