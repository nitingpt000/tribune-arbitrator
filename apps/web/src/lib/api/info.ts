import { useQuery } from '@tanstack/react-query';

import { tribuneClient } from './client';

export interface InfoResponse {
  version: string;
  appProfile: 'local' | 'demo' | 'test' | 'replay' | 'unknown';
  panelMode: 'live' | 'replay' | 'test' | 'mock' | 'unknown';
  demoModeLabel: string;
  panelServiceUrl: string;
}

const KEYS = { info: ['info'] as const };

export function useInfo() {
  return useQuery({
    queryKey: KEYS.info,
    queryFn: async ({ signal }): Promise<InfoResponse> => {
      const url = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
      void tribuneClient;
      const res = await fetch(`${url}/info`, { signal });
      if (!res.ok) throw new Error(`info ${res.status}`);
      return (await res.json()) as InfoResponse;
    },
    staleTime: 60_000,
    retry: 0,
  });
}
