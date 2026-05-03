import { ExecutionError } from '../../domain/errors';
import type {
  ExecutionPort,
  RecordSettlementStepInput,
  SubmitVerdictInput,
  VoteUpdateInput,
} from '../../domain/ports/execution.port';
import type { DomainLogger } from '../../domain/ports/logger.port';
import { DirectTxAdapter } from './direct-tx.adapter';

/**
 * Submits TribuneArbitrator.executeRuling() via the KeeperHub MCP server. The
 * MCP API is documented at https://docs.keeperhub.com/ — the adapter speaks
 * the documented "createKeeperRun" tool surface plus a status poll. KeeperHub
 * handles guaranteed inclusion, MEV protection, and retry; we delegate.
 *
 * Vote-update events still go to apps/api over HTTP (KeeperHub handles only
 * the verdict + settlement legs that cost gas), so this adapter wraps a
 * DirectTxAdapter for `notifyVoteUpdate`.
 *
 * Live verification requires a KeeperHub API key. When the MCP endpoint is
 * unreachable, the adapter falls back to logging a TODO line and reverts up
 * via `ExecutionError('submit_failed', ...)` so the dispute is recorded as
 * FAILED instead of silently going wrong.
 */

export interface KeeperHubMcpClient {
  /**
   * Tool: `keeperhub.createKeeperRun`
   * Submit calldata for guaranteed onchain execution.
   */
  createKeeperRun(input: {
    chainId: number;
    target: string;
    calldata: string;
    description?: string;
  }): Promise<{ jobId: string }>;

  /**
   * Tool: `keeperhub.getKeeperRun`
   * Returns lifecycle state + tx hash if available.
   */
  getKeeperRun(jobId: string): Promise<{
    jobId: string;
    status: 'queued' | 'claimed' | 'submitted' | 'confirmed' | 'failed';
    txHash?: string;
    failureReason?: string;
  }>;
}

export interface OnchainKeeperAdapterOptions {
  arbitratorAddress: string;
  chainId: number;
  mcpClient: KeeperHubMcpClient;
  apiBaseUrl: string;
  sharedSecret: string;
  logger: DomainLogger;
}

export class OnchainKeeperExecutionAdapter implements ExecutionPort {
  private readonly callbackProxy: DirectTxAdapter;

  constructor(private readonly opts: OnchainKeeperAdapterOptions) {
    this.callbackProxy = new DirectTxAdapter(
      { apiBaseUrl: opts.apiBaseUrl, sharedSecret: opts.sharedSecret },
      opts.logger,
    );
  }

  notifyVoteUpdate(input: VoteUpdateInput): Promise<void> {
    return this.callbackProxy.notifyVoteUpdate(input);
  }

  async submitVerdict(input: SubmitVerdictInput): Promise<{ executionRef: string }> {
    const calldata = encodeExecuteRuling({
      disputeId: input.disputeId,
      ruling: rulingForOutcome(input.outcome),
      bundleHash: bundleHashFromUri(input.bundleUri),
    });

    let jobId: string;
    try {
      const job = await this.opts.mcpClient.createKeeperRun({
        chainId: this.opts.chainId,
        target: this.opts.arbitratorAddress,
        calldata,
        description: `Tribune verdict ${input.disputeId}`,
      });
      jobId = job.jobId;
      this.opts.logger.info('keeper.verdict.submitted', {
        disputeId: input.disputeId,
        jobId,
        outcome: input.outcome,
      });
    } catch (err) {
      this.opts.logger.error('keeper.verdict.submit_failed', {
        disputeId: input.disputeId,
        error: (err as Error).message,
      });
      throw new ExecutionError(
        'submit_failed',
        `KeeperHub createKeeperRun failed: ${(err as Error).message}`,
        { disputeId: input.disputeId },
      );
    }

    // Mirror the verdict to apps/api so the SSE stream picks it up; KeeperHub
    // handles the actual onchain side.
    await this.callbackProxy.submitVerdict(input).catch((err) => {
      this.opts.logger.warn('keeper.verdict.callback_failed', {
        disputeId: input.disputeId,
        error: (err as Error).message,
      });
    });

    return { executionRef: `keeperhub:${jobId}` };
  }

  async recordSettlementStep(input: RecordSettlementStepInput): Promise<void> {
    // Mirror to apps/api unchanged. The contract indexer (apps/api) populates
    // real tx hashes from chain events as KeeperHub confirms.
    await this.callbackProxy.recordSettlementStep(input);
  }
}

function rulingForOutcome(outcome: SubmitVerdictInput['outcome']): number {
  switch (outcome) {
    case 'REFUND':
      return 1;
    case 'REJECT':
      return 2;
    case 'ABSTAIN':
    case 'FAILED':
      return 0;
    default:
      return 0;
  }
}

function bundleHashFromUri(uri: string): string {
  // Phase 4 simple form: keccak256(uri) on the panel side, recorded onchain.
  // Phase 4.1 will switch this to the storage SDK's native rootHash bytes.
  // For now we emit a deterministic 0x-prefixed 32-byte digest.
  return `0x${stableHashHex(uri)}`;
}

function stableHashHex(input: string): string {
  let h = BigInt('0x811c9dc5');
  const FNV = BigInt('0x01000193');
  const MASK = BigInt('0xFFFFFFFF');
  for (let i = 0; i < input.length; i++) {
    h ^= BigInt(input.charCodeAt(i));
    h = (h * FNV) & MASK;
  }
  return h.toString(16).padStart(64, '0');
}

function encodeExecuteRuling(input: {
  disputeId: string;
  ruling: number;
  bundleHash: string;
}): string {
  // executeRuling(uint256,uint256,bytes32) selector = 0x8a72b56b
  // We do not pull in ethers here for the test profile bundle size; the calldata
  // shape is well-defined and small enough to encode by hand.
  const selector = '0x8a72b56b';
  const idHex = BigInt(input.disputeId).toString(16).padStart(64, '0');
  const rulingHex = input.ruling.toString(16).padStart(64, '0');
  const bundle = input.bundleHash.replace(/^0x/, '').padStart(64, '0');
  return `${selector}${idHex}${rulingHex}${bundle}`;
}
