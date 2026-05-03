import type { DomainLogger } from '../../domain/ports/logger.port';
import type { KeeperHubMcpClient } from './onchain-keeper.adapter';

/**
 * Thin HTTP client for the KeeperHub MCP server. Speaks two tools:
 *   `keeperhub.createKeeperRun`  → POST {mcpUrl}/tools/keeperhub.createKeeperRun
 *   `keeperhub.getKeeperRun`     → POST {mcpUrl}/tools/keeperhub.getKeeperRun
 *
 * The exact tool names + request/response shapes follow docs.keeperhub.com
 * conventions. Live verification against a real key is a Phase 4 follow-up;
 * see FEEDBACK.md for the DX notes.
 */
export class HttpKeeperHubMcpClient implements KeeperHubMcpClient {
  constructor(
    private readonly mcpUrl: string,
    private readonly apiKey: string,
    private readonly logger: DomainLogger,
  ) {}

  async createKeeperRun(input: {
    chainId: number;
    target: string;
    calldata: string;
    description?: string;
  }): Promise<{ jobId: string }> {
    const body = await this.invoke('keeperhub.createKeeperRun', input);
    if (
      typeof body !== 'object' ||
      body === null ||
      typeof (body as { jobId?: unknown }).jobId !== 'string'
    ) {
      throw new Error('createKeeperRun returned no jobId');
    }
    return { jobId: (body as { jobId: string }).jobId };
  }

  async getKeeperRun(jobId: string): Promise<{
    jobId: string;
    status: 'queued' | 'claimed' | 'submitted' | 'confirmed' | 'failed';
    txHash?: string;
    failureReason?: string;
  }> {
    const body = await this.invoke('keeperhub.getKeeperRun', { jobId });
    return body as {
      jobId: string;
      status: 'queued' | 'claimed' | 'submitted' | 'confirmed' | 'failed';
      txHash?: string;
      failureReason?: string;
    };
  }

  private async invoke(tool: string, args: unknown): Promise<unknown> {
    const url = `${this.mcpUrl.replace(/\/$/, '')}/tools/${tool}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(args),
      });
    } catch (err) {
      this.logger.warn('keeperhub.mcp.network', { tool, error: (err as Error).message });
      throw err;
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.warn('keeperhub.mcp.non_2xx', {
        tool,
        status: response.status,
        bodySnippet: text.slice(0, 240),
      });
      throw new Error(`KeeperHub MCP ${tool} returned ${response.status}`);
    }
    return response.json();
  }
}
