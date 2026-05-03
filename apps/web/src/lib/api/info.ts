import { useQuery } from '@tanstack/react-query';

import { tribuneClient } from './client';

export interface ContractAddresses {
  arbitrator: string | null;
  panelRegistry: string | null;
  exampleEscrow: string | null;
  settlementToken: string | null;
  chainId: number;
  explorerBaseUrl: string;
}

export interface InfoResponse {
  version: string;
  appProfile: 'local' | 'demo' | 'test' | 'replay' | 'unknown';
  panelMode: 'live' | 'live-onchain' | 'replay' | 'replay-onchain' | 'test' | 'mock' | 'unknown';
  demoModeLabel: string;
  panelServiceUrl: string;
  contracts?: ContractAddresses;
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

export function explorerTxUrl(info: InfoResponse | undefined, txHash: string): string | null {
  if (!info?.contracts?.explorerBaseUrl) return null;
  if (!txHash || txHash === '0x' || /^0x0+$/.test(txHash)) return null;
  return `${info.contracts.explorerBaseUrl.replace(/\/$/, '')}/tx/${txHash}`;
}
