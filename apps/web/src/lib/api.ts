import type { AgentReputation, Dispute, Evidence } from '@tribune/types';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new ApiError(response.status, detail || response.statusText);
  }

  return response.json() as Promise<T>;
}

export const api = {
  listDisputes: (): Promise<Dispute[]> => request('/disputes'),
  getDispute: (id: string): Promise<Dispute> => request(`/disputes/${id}`),
  submitEvidence: (id: string, body: unknown): Promise<Evidence> =>
    request(`/disputes/${id}/evidence`, { method: 'POST', body: JSON.stringify(body) }),
  getAgentReputation: (ens: string): Promise<AgentReputation> =>
    request(`/agents/${encodeURIComponent(ens)}/reputation`),
};

export { ApiError };
