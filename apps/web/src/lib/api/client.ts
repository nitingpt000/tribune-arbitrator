import {
  type AddEvidenceInput,
  type AgentReputationResponse,
  type CreateDisputeInput,
  type Dispute,
  type DisputeListQuery,
  type DisputeListResponse,
  type Evidence,
  type StatsResponse,
} from '@tribune/types';

const DEFAULT_BASE_URL =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL
    : 'http://localhost:3001';

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string | null;
  readonly errors?: Array<{ path: string; message: string }>;
  readonly requestId?: string;

  constructor(opts: {
    status: number;
    message: string;
    detail?: string | null;
    errors?: Array<{ path: string; message: string }>;
    requestId?: string;
  }) {
    super(opts.message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.detail = opts.detail ?? null;
    this.errors = opts.errors;
    this.requestId = opts.requestId;
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

interface RequestOpts {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  query?: Record<string, string | number | undefined>;
}

function buildUrl(baseUrl: string, path: string, query?: RequestOpts['query']): string {
  const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function request<T>(baseUrl: string, path: string, opts: RequestOpts = {}): Promise<T> {
  const url = buildUrl(baseUrl, path, opts.query);
  let response: Response;
  try {
    response = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: opts.body ? { 'content-type': 'application/json' } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new NetworkError(err instanceof Error ? err.message : 'Network request failed');
  }

  if (!response.ok) {
    let problem: Record<string, unknown> = {};
    try {
      problem = (await response.json()) as Record<string, unknown>;
    } catch {
      // not JSON; fall through
    }
    throw new ApiError({
      status: response.status,
      message:
        typeof problem.title === 'string'
          ? problem.title
          : `Request failed with ${response.status}`,
      detail: typeof problem.detail === 'string' ? problem.detail : null,
      errors:
        typeof problem.errors === 'object' && Array.isArray(problem.errors)
          ? (problem.errors as Array<{ path: string; message: string }>)
          : undefined,
    });
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface TribuneClientOpts {
  baseUrl?: string;
}

export class TribuneClient {
  private readonly baseUrl: string;

  constructor(opts: TribuneClientOpts = {}) {
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
  }

  getStats(signal?: AbortSignal): Promise<StatsResponse> {
    return request<StatsResponse>(this.baseUrl, 'disputes/stats', { signal });
  }

  listDisputes(
    query: Partial<DisputeListQuery> = {},
    signal?: AbortSignal,
  ): Promise<DisputeListResponse> {
    return request<DisputeListResponse>(this.baseUrl, 'disputes', { query, signal });
  }

  getDispute(id: string, signal?: AbortSignal): Promise<Dispute> {
    return request<Dispute>(this.baseUrl, `disputes/${encodeURIComponent(id)}`, { signal });
  }

  createDispute(input: CreateDisputeInput): Promise<Dispute> {
    return request<Dispute>(this.baseUrl, 'disputes', { method: 'POST', body: input });
  }

  addEvidence(disputeId: string, input: AddEvidenceInput): Promise<Evidence> {
    return request<Evidence>(this.baseUrl, `disputes/${encodeURIComponent(disputeId)}/evidence`, {
      method: 'POST',
      body: input,
    });
  }

  getAgentReputation(ens: string, signal?: AbortSignal): Promise<AgentReputationResponse> {
    return request<AgentReputationResponse>(
      this.baseUrl,
      `agents/${encodeURIComponent(ens)}/reputation`,
      { signal },
    );
  }

  getAgentDisputes(
    ens: string,
    query: Partial<DisputeListQuery> = {},
    signal?: AbortSignal,
  ): Promise<DisputeListResponse> {
    return request<DisputeListResponse>(
      this.baseUrl,
      `agents/${encodeURIComponent(ens)}/disputes`,
      { query, signal },
    );
  }

  streamUrl(disputeId: string): string {
    return buildUrl(this.baseUrl, `disputes/${encodeURIComponent(disputeId)}/stream`);
  }
}

export const tribuneClient = new TribuneClient();
