import { ExecutionError } from '../../domain/errors';
import type {
  ExecutionPort,
  RecordSettlementStepInput,
  SubmitVerdictInput,
  VoteUpdateInput,
} from '../../domain/ports/execution.port';
import type { DomainLogger } from '../../domain/ports/logger.port';

export interface DirectTxAdapterOptions {
  apiBaseUrl: string;
  sharedSecret: string;
  fetchImpl?: typeof fetch;
}

export class DirectTxAdapter implements ExecutionPort {
  constructor(
    private readonly options: DirectTxAdapterOptions,
    private readonly logger: DomainLogger,
  ) {}

  notifyVoteUpdate(input: VoteUpdateInput): Promise<void> {
    return this.callback('/panel-callback/vote-update', input);
  }

  async submitVerdict(input: SubmitVerdictInput): Promise<{ executionRef: string }> {
    await this.callback('/panel-callback/verdict', input);
    return { executionRef: `apps-api:${input.disputeId}` };
  }

  recordSettlementStep(input: RecordSettlementStepInput): Promise<void> {
    return this.callback('/panel-callback/settlement-step', input);
  }

  private async callback(path: string, body: unknown): Promise<void> {
    const url = `${this.options.apiBaseUrl.replace(/\/$/, '')}${path}`;
    const fetchImpl = this.options.fetchImpl ?? fetch;
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tribune-panel-secret': this.options.sharedSecret,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      this.logger.warn('execution.callback.network_error', {
        path,
        error: (err as Error).message,
      });
      throw new ExecutionError('callback_failed', (err as Error).message, { path });
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.warn('execution.callback.non_2xx', {
        path,
        status: response.status,
        body: text.slice(0, 200),
      });
      throw new ExecutionError('callback_failed', `apps/api ${path} responded ${response.status}`, {
        status: response.status,
      });
    }
  }
}
