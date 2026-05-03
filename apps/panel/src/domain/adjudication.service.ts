import { AdjudicationTimeout, InferenceError, NoAvailableModels, StorageError } from './errors';
import { PanelVoteAggregator } from './panel-vote-aggregator';
import { parsePanelistResponse } from './parse-panelist-response';
import type { Clock } from './ports/clock.port';
import type { ExecutionPort } from './ports/execution.port';
import type { IdentityPort } from './ports/identity.port';
import type { InferencePort } from './ports/inference.port';
import type { DomainLogger } from './ports/logger.port';
import type { StoragePort } from './ports/storage.port';
import { PROMPT_VERSION, PromptBuilder, SYSTEM_PROMPT } from './prompt-builder';
import type { EvidenceBundle } from './types/evidence';
import type {
  DisputeOutcome,
  PanelistVerdict,
  SettlementStepType,
  Verdict,
  VerdictBundle,
} from './types/panel';

const PANELIST_TIMEOUT_MS = 30_000;
const MAX_BUNDLE_BYTES = 5 * 1024 * 1024;
const SETTLEMENT_GAP_MS = {
  VERDICT_ONCHAIN: 600,
  KEEPER_CLAIMED: 400,
  FUNDS_RELEASED: 800,
  ENS_REPUTATION: 400,
} as const;

export interface AdjudicateInput {
  disputeId: string;
  evidenceBundle: EvidenceBundle;
}

export class AdjudicationService {
  private readonly aggregator = new PanelVoteAggregator();
  private readonly promptBuilder = new PromptBuilder();

  constructor(
    private readonly inference: InferencePort,
    private readonly storage: StoragePort,
    private readonly execution: ExecutionPort,
    private readonly identity: IdentityPort,
    private readonly clock: Clock,
    private readonly logger: DomainLogger,
  ) {}

  async adjudicate({ disputeId, evidenceBundle }: AdjudicateInput): Promise<Verdict> {
    const log = this.logger.child({ disputeId });
    const start = this.clock.monotonicMs();

    log.info('adjudication.start', {
      claimant: evidenceBundle.claimantEns,
      respondent: evidenceBundle.respondentEns,
      claimType: evidenceBundle.claimType,
      evidenceFiles: evidenceBundle.files.length,
    });

    const models = await this.inference.listAvailableModels();
    const distinctPanel = pickDistinctModels(models, 3);
    if (distinctPanel.length < 3) {
      log.error('adjudication.no_models', { available: models.length });
      throw new NoAvailableModels(distinctPanel.length);
    }
    log.info('adjudication.panel_selected', { models: distinctPanel });

    const evidenceUri = await this.persistEvidenceBundle(evidenceBundle).catch((err) => {
      log.warn('adjudication.evidence_persist_failed', {
        error: serialiseError(err),
      });
      return 'inline://unpersisted-evidence';
    });

    const panelists = await this.runPanel({
      disputeId,
      models: distinctPanel,
      bundle: evidenceBundle,
      log,
    });

    const aggregate = this.aggregator.aggregate({ panelists });
    log.info('adjudication.aggregated', {
      outcome: aggregate.outcome,
      votesFor: aggregate.votesFor,
      votesAgainst: aggregate.votesAgainst,
    });

    const totalDurationMs = this.clock.monotonicMs() - start;

    const bundleUri = await this.persistVerdictBundle({
      disputeId,
      panelists,
      outcome: aggregate.outcome,
      votesFor: aggregate.votesFor,
      votesAgainst: aggregate.votesAgainst,
      totalDurationMs,
      evidenceBundle,
    }).catch((err) => {
      log.error('adjudication.bundle_persist_failed', { error: serialiseError(err) });
      throw err instanceof StorageError
        ? err
        : new StorageError('upload_failed', (err as Error).message);
    });

    const totalCostUsd = estimateCostUsd(panelists);
    log.info('adjudication.persisted', { bundleUri, totalDurationMs, totalCostUsd });

    await this.execution.submitVerdict({
      disputeId,
      outcome: aggregate.outcome === 'FAILED' ? 'FAILED' : aggregate.outcome,
      votesFor: aggregate.votesFor,
      votesAgainst: aggregate.votesAgainst,
      bundleUri,
      totalDurationMs,
      totalCostUsd,
    });

    if (aggregate.outcome !== 'FAILED') {
      await this.runSettlementSteps(disputeId, aggregate.outcome, log);
      await this.writeReputations({
        disputeId,
        outcome: aggregate.outcome,
        bundleUri,
        evidenceBundle,
        log,
      });
    }

    log.info('adjudication.done', {
      outcome: aggregate.outcome,
      durationMs: totalDurationMs,
      evidenceUri,
    });

    return {
      disputeId,
      outcome: aggregate.outcome,
      votesFor: aggregate.votesFor,
      votesAgainst: aggregate.votesAgainst,
      panelists,
      bundleUri,
      totalDurationMs,
      totalCostUsd,
      promptVersion: PROMPT_VERSION,
      createdAtIso: this.clock.now().toISOString(),
    };
  }

  private async runPanel(input: {
    disputeId: string;
    models: string[];
    bundle: EvidenceBundle;
    log: DomainLogger;
  }): Promise<PanelistVerdict[]> {
    const { models, bundle, log } = input;
    const built = models.map((_modelName, idx) =>
      this.promptBuilder.build({
        bundle,
        panelistIndex: idx,
        seed: input.disputeId,
      }),
    );

    return Promise.all(
      models.map(async (modelName, idx) => {
        const prompt = built[idx]!;
        const childLog = log.child({ modelName });
        await this.execution
          .notifyVoteUpdate({
            disputeId: input.disputeId,
            modelName,
            status: 'REASONING',
          })
          .catch((err) => {
            childLog.warn('panelist.notify_reasoning_failed', { error: serialiseError(err) });
          });

        const start = this.clock.monotonicMs();
        try {
          const result = await this.withTimeout(
            this.inference.runPanelist({
              modelName,
              systemPrompt: prompt.systemPrompt,
              userPrompt: prompt.userPrompt,
              maxTokens: 512,
              temperature: 0.2,
            }),
            PANELIST_TIMEOUT_MS,
            modelName,
          );

          const parsed = parsePanelistResponse(result.rawResponse);
          if (!parsed.ok) {
            const failed: PanelistVerdict = {
              modelName,
              vote: 'ABSTAIN',
              confidence: 0,
              reasoning: '',
              status: 'FAILED',
              rawResponse: result.rawResponse,
              attestation: result.attestation ?? null,
              latencyMs: result.latencyMs,
              promptTokens: result.promptTokens,
              completionTokens: result.completionTokens,
              errorCode: parsed.errorCode,
              errorMessage: parsed.errorMessage,
            };
            childLog.warn('panelist.parse_failed', {
              code: parsed.errorCode,
              message: parsed.errorMessage,
            });
            await this.execution
              .notifyVoteUpdate({
                disputeId: input.disputeId,
                modelName,
                status: 'FAILED',
              })
              .catch(() => undefined);
            return failed;
          }

          const ok: PanelistVerdict = {
            modelName,
            vote: parsed.vote,
            confidence: parsed.confidence,
            reasoning: parsed.reasoning,
            status: 'VOTED',
            rawResponse: result.rawResponse,
            attestation: result.attestation ?? null,
            latencyMs: result.latencyMs,
            promptTokens: result.promptTokens,
            completionTokens: result.completionTokens,
          };
          await this.execution
            .notifyVoteUpdate({
              disputeId: input.disputeId,
              modelName,
              status: 'VOTED',
              vote: parsed.vote,
              confidence: parsed.confidence,
              reasoning: parsed.reasoning,
            })
            .catch((err) => {
              childLog.warn('panelist.notify_voted_failed', {
                error: serialiseError(err),
              });
            });
          childLog.info('panelist.voted', {
            vote: parsed.vote,
            confidence: parsed.confidence,
            latencyMs: result.latencyMs,
          });
          return ok;
        } catch (err) {
          const latencyMs = this.clock.monotonicMs() - start;
          const code =
            err instanceof AdjudicationTimeout
              ? 'timeout'
              : err instanceof InferenceError
                ? err.code
                : 'unknown';
          childLog.error('panelist.failed', {
            error: serialiseError(err),
            latencyMs,
          });
          await this.execution
            .notifyVoteUpdate({
              disputeId: input.disputeId,
              modelName,
              status: 'FAILED',
            })
            .catch(() => undefined);
          return {
            modelName,
            vote: 'ABSTAIN',
            confidence: 0,
            reasoning: '',
            status: 'FAILED',
            rawResponse: '',
            attestation: null,
            latencyMs,
            promptTokens: 0,
            completionTokens: 0,
            errorCode: code,
            errorMessage: err instanceof Error ? err.message : String(err),
          } satisfies PanelistVerdict;
        }
      }),
    );
  }

  private async runSettlementSteps(
    disputeId: string,
    _outcome: DisputeOutcome,
    log: DomainLogger,
  ): Promise<void> {
    const steps: SettlementStepType[] = [
      'VERDICT_ONCHAIN',
      'KEEPER_CLAIMED',
      'FUNDS_RELEASED',
      'ENS_REPUTATION',
    ];
    for (const step of steps) {
      await this.execution.recordSettlementStep({
        disputeId,
        step,
        status: 'IN_PROGRESS',
      });
      await this.clock.delay(SETTLEMENT_GAP_MS[step]);
      await this.execution.recordSettlementStep({
        disputeId,
        step,
        status: 'COMPLETED',
        detail: detailFor(step),
      });
      log.info('settlement.step.completed', { step });
    }
  }

  private async writeReputations(input: {
    disputeId: string;
    outcome: DisputeOutcome;
    bundleUri: string;
    evidenceBundle: EvidenceBundle;
    log: DomainLogger;
  }): Promise<void> {
    if (input.outcome === 'FAILED' || input.outcome === 'ABSTAIN') return;
    const claimantOutcome: 'won' | 'lost' = input.outcome === 'REFUND' ? 'won' : 'lost';
    const respondentOutcome: 'won' | 'lost' = input.outcome === 'REFUND' ? 'lost' : 'won';
    await Promise.allSettled([
      this.identity.writeReputation(input.evidenceBundle.claimantEns, {
        outcome: claimantOutcome,
        reason: claimantOutcome === 'won' ? 'verdict_for' : 'verdict_against',
        verdictBundleUri: input.bundleUri,
      }),
      this.identity.writeReputation(input.evidenceBundle.respondentEns, {
        outcome: respondentOutcome,
        reason: respondentOutcome === 'won' ? 'verdict_for' : 'verdict_against',
        verdictBundleUri: input.bundleUri,
      }),
    ]).then((results) => {
      for (const r of results) {
        if (r.status === 'rejected') {
          input.log.warn('reputation.write_failed', { error: serialiseError(r.reason) });
        }
      }
    });
  }

  private async persistEvidenceBundle(bundle: EvidenceBundle): Promise<string> {
    const payload = JSON.stringify(bundle);
    const bytes = new TextEncoder().encode(payload);
    if (bytes.byteLength > MAX_BUNDLE_BYTES) {
      throw new StorageError('upload_failed', 'evidence bundle exceeds cap', {
        size: bytes.byteLength,
      });
    }
    const result = await this.storage.put({
      content: bytes,
      contentType: 'application/json',
      accessControl: {
        authorizedReaders: [bundle.claimantEns, bundle.respondentEns, 'tribune.system'],
      },
    });
    return result.uri;
  }

  private async persistVerdictBundle(input: {
    disputeId: string;
    panelists: PanelistVerdict[];
    outcome: DisputeOutcome;
    votesFor: number;
    votesAgainst: number;
    totalDurationMs: number;
    evidenceBundle: EvidenceBundle;
  }): Promise<string> {
    const bundle: VerdictBundle = {
      schemaVersion: 1,
      promptVersion: PROMPT_VERSION,
      disputeId: input.disputeId,
      systemPrompt: SYSTEM_PROMPT,
      userPromptTemplate: '<<DISPUTE_START>>…<<DISPUTE_END>> (see reasoning per panelist)',
      panelists: input.panelists,
      outcome: input.outcome,
      votesFor: input.votesFor,
      votesAgainst: input.votesAgainst,
      decidedAtIso: this.clock.now().toISOString(),
      totalDurationMs: input.totalDurationMs,
    };
    const bytes = new TextEncoder().encode(JSON.stringify(bundle, null, 2));
    if (bytes.byteLength > MAX_BUNDLE_BYTES) {
      throw new StorageError('upload_failed', 'verdict bundle exceeds cap', {
        size: bytes.byteLength,
      });
    }
    const result = await this.storage.put({
      content: bytes,
      contentType: 'application/json',
      accessControl: {
        authorizedReaders: [
          input.evidenceBundle.claimantEns,
          input.evidenceBundle.respondentEns,
          'tribune.system',
        ],
      },
    });
    return result.uri;
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    deadlineMs: number,
    modelName: string,
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(
            () => reject(new AdjudicationTimeout(modelName, deadlineMs)),
            deadlineMs,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

function pickDistinctModels(models: readonly string[], n: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of models) {
    const key = familyKey(m);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
    if (out.length === n) break;
  }
  if (out.length < n) {
    for (const m of models) {
      if (out.includes(m)) continue;
      out.push(m);
      if (out.length === n) break;
    }
  }
  return out.slice(0, n);
}

function familyKey(modelName: string): string {
  const lower = modelName.toLowerCase();
  if (lower.includes('llama')) return 'llama';
  if (lower.includes('deepseek')) return 'deepseek';
  if (lower.includes('qwen')) return 'qwen';
  if (lower.includes('glm')) return 'glm';
  if (lower.includes('mistral')) return 'mistral';
  if (lower.includes('gemma')) return 'gemma';
  return lower.split(/[-_./]/)[0] ?? lower;
}

function detailFor(step: SettlementStepType): string {
  switch (step) {
    case 'VERDICT_ONCHAIN':
      return 'verdict signed by panel and submitted (Phase 3 stub; KeeperHub wires Phase 4)';
    case 'KEEPER_CLAIMED':
      return 'guaranteed-claim adapter recorded the verdict (Phase 3 stub)';
    case 'FUNDS_RELEASED':
      return 'settlement instruction queued (Phase 3 stub; Uniswap routing in Phase 4)';
    case 'ENS_REPUTATION':
      return 'reputation written to Tribune ledger; ENS write follows in Phase 4';
  }
}

function estimateCostUsd(panelists: readonly PanelistVerdict[]): number {
  // Rough: 0.0001 OG per request, OG_USD_RATE not known here.
  // We default to $0.0005 per panelist as a placeholder; the live profile overrides
  // by reading per-provider pricing from the broker.
  return Number((panelists.length * 0.0005).toFixed(4));
}

function serialiseError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    const obj: Record<string, unknown> = { name: err.name, message: err.message };
    const maybe = err as unknown as { code?: unknown; context?: unknown };
    if (typeof maybe.code === 'string') obj.code = maybe.code;
    if (maybe.context && typeof maybe.context === 'object') obj.context = maybe.context;
    return obj;
  }
  return { value: String(err) };
}
