import { LogOnlyExecutionAdapter } from '../src/adapters/execution/log-only.adapter';
import { MemoryIdentityAdapter } from '../src/adapters/identity/memory.adapter';
import { MemoryStorageAdapter } from '../src/adapters/storage/memory.adapter';
import { AdjudicationService } from '../src/domain/adjudication.service';
import type { Clock } from '../src/domain/ports/clock.port';
import type {
  ExecutionPort,
  RecordSettlementStepInput,
  SubmitVerdictInput,
  VoteUpdateInput,
} from '../src/domain/ports/execution.port';
import type { IdentityPort } from '../src/domain/ports/identity.port';
import type {
  InferenceCall,
  InferencePort,
  InferenceResult,
} from '../src/domain/ports/inference.port';
import type { DomainLogger } from '../src/domain/ports/logger.port';
import type { StoragePort } from '../src/domain/ports/storage.port';
import type { EvidenceBundle } from '../src/domain/types/evidence';
import { FastClock } from '../src/infrastructure/clock/system-clock';
import { NoopDomainLogger } from '../src/infrastructure/logging/pino-logger';

export interface ScriptedInferenceEntry {
  modelName: string;
  result?: InferenceResult;
  error?: Error;
  delayMs?: number;
}

export class ScriptedInferenceAdapter implements InferencePort {
  readonly calls: InferenceCall[] = [];
  constructor(private readonly script: ScriptedInferenceEntry[]) {}

  async listAvailableModels(): Promise<string[]> {
    return this.script.map((s) => s.modelName);
  }

  async runPanelist(input: InferenceCall): Promise<InferenceResult> {
    this.calls.push(input);
    const entry = this.script.find((s) => s.modelName === input.modelName) ?? this.script[0]!;
    if (entry.error) throw entry.error;
    if (entry.delayMs) await new Promise((res) => setTimeout(res, entry.delayMs));
    if (!entry.result) {
      throw new Error(`No scripted result for ${input.modelName}`);
    }
    return entry.result;
  }
}

export function makeBundle(overrides: Partial<EvidenceBundle> = {}): EvidenceBundle {
  return {
    disputeId: 'test-dispute-id',
    claimType: 'service_not_delivered',
    statement: 'The seller delivered 3 entries; the SOW required 7. Refund.',
    claimantEns: 'alice.test.eth',
    respondentEns: 'bob.test.eth',
    txHash: '0x' + 'a'.repeat(64),
    amountUsdc: 250,
    files: [
      {
        id: 'ev-1',
        filename: 'sow.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        storageUri: 'mock://sow',
      },
    ],
    ...overrides,
  };
}

export interface RigOptions {
  inference?: InferencePort;
  storage?: StoragePort;
  execution?: ExecutionPort;
  identity?: IdentityPort;
  clock?: Clock;
  logger?: DomainLogger;
}

export interface AdjudicationRig {
  service: AdjudicationService;
  storage: MemoryStorageAdapter;
  execution: LogOnlyExecutionAdapter;
  identity: MemoryIdentityAdapter;
  logger: DomainLogger;
}

export function makeRig(opts: RigOptions = {}): AdjudicationRig & {
  inference: InferencePort;
} {
  const logger = opts.logger ?? new NoopDomainLogger();
  const inference = opts.inference ?? new ScriptedInferenceAdapter([]);
  const storage = (opts.storage as MemoryStorageAdapter) ?? new MemoryStorageAdapter();
  const execution =
    (opts.execution as LogOnlyExecutionAdapter) ?? new LogOnlyExecutionAdapter(logger);
  const identity = (opts.identity as MemoryIdentityAdapter) ?? new MemoryIdentityAdapter();
  const clock = opts.clock ?? new FastClock();
  const service = new AdjudicationService(
    inference,
    storage as StoragePort,
    execution as ExecutionPort,
    identity as IdentityPort,
    clock,
    logger,
  );
  return { service, storage, execution, identity, logger, inference };
}

export function buildOk(
  _modelName: string,
  vote: 'REFUND' | 'REJECT' | 'ABSTAIN',
  confidence = 0.85,
  reasoning = 'Reasoned',
): InferenceResult {
  return {
    rawResponse: JSON.stringify({ vote, confidence, reasoning }),
    promptTokens: 200,
    completionTokens: 60,
    latencyMs: 10,
    attestation: 'tee:verified',
  };
}

export function expectVoteUpdates(
  execution: LogOnlyExecutionAdapter,
  predicate: (input: VoteUpdateInput | SubmitVerdictInput | RecordSettlementStepInput) => boolean,
): number {
  return execution.events.filter((e) => predicate(e.input)).length;
}
