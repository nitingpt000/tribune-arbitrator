import type {
  ExecutionPort,
  RecordSettlementStepInput,
  SubmitVerdictInput,
  VoteUpdateInput,
} from '../../domain/ports/execution.port';
import type { DomainLogger } from '../../domain/ports/logger.port';

export class LogOnlyExecutionAdapter implements ExecutionPort {
  readonly events: Array<
    | { kind: 'vote.update'; input: VoteUpdateInput }
    | { kind: 'submit.verdict'; input: SubmitVerdictInput }
    | { kind: 'settlement.step'; input: RecordSettlementStepInput }
  > = [];

  constructor(private readonly logger: DomainLogger) {}

  async notifyVoteUpdate(input: VoteUpdateInput): Promise<void> {
    this.events.push({ kind: 'vote.update', input });
    this.logger.info('execution.vote.update', input as unknown as Record<string, unknown>);
  }

  async submitVerdict(input: SubmitVerdictInput): Promise<{ executionRef: string }> {
    this.events.push({ kind: 'submit.verdict', input });
    this.logger.info('execution.verdict.submit', input as unknown as Record<string, unknown>);
    return { executionRef: `log-only:${input.disputeId}` };
  }

  async recordSettlementStep(input: RecordSettlementStepInput): Promise<void> {
    this.events.push({ kind: 'settlement.step', input });
    this.logger.info('execution.settlement.step', input as unknown as Record<string, unknown>);
  }
}
