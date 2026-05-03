import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AddEvidenceInput,
  CreateDisputeInput,
  Dispute,
  DisputeListQuery,
  Evidence,
} from '@tribune/types';

import { tribuneClient } from './client';

export const disputeKeys = {
  all: ['disputes'] as const,
  list: (query: Partial<DisputeListQuery> = {}) => [...disputeKeys.all, 'list', query] as const,
  detail: (id: string) => [...disputeKeys.all, 'detail', id] as const,
  stats: () => [...disputeKeys.all, 'stats'] as const,
};

export const agentKeys = {
  all: ['agents'] as const,
  reputation: (ens: string) => [...agentKeys.all, 'reputation', ens] as const,
  disputes: (ens: string, query: Partial<DisputeListQuery>) =>
    [...agentKeys.all, 'disputes', ens, query] as const,
};

export const disputesListOptions = (query: Partial<DisputeListQuery> = {}) =>
  queryOptions({
    queryKey: disputeKeys.list(query),
    queryFn: ({ signal }) => tribuneClient.listDisputes(query, signal),
    staleTime: 5_000,
  });

export const disputeOptions = (id: string) =>
  queryOptions({
    queryKey: disputeKeys.detail(id),
    queryFn: ({ signal }) => tribuneClient.getDispute(id, signal),
    staleTime: 0,
    enabled: Boolean(id),
  });

export const statsOptions = () =>
  queryOptions({
    queryKey: disputeKeys.stats(),
    queryFn: ({ signal }) => tribuneClient.getStats(signal),
    staleTime: 10_000,
    refetchInterval: 20_000,
  });

export const agentReputationOptions = (ens: string) =>
  queryOptions({
    queryKey: agentKeys.reputation(ens),
    queryFn: ({ signal }) => tribuneClient.getAgentReputation(ens, signal),
    staleTime: 5_000,
    enabled: Boolean(ens),
  });

export const agentDisputesOptions = (ens: string, query: Partial<DisputeListQuery> = {}) =>
  queryOptions({
    queryKey: agentKeys.disputes(ens, query),
    queryFn: ({ signal }) => tribuneClient.getAgentDisputes(ens, query, signal),
    staleTime: 5_000,
    enabled: Boolean(ens),
  });

export function useDisputes(query: Partial<DisputeListQuery> = {}) {
  return useQuery(disputesListOptions(query));
}

export function useDispute(id: string) {
  return useQuery(disputeOptions(id));
}

export function useStats() {
  return useQuery(statsOptions());
}

export function useAgentReputation(ens: string) {
  return useQuery(agentReputationOptions(ens));
}

export function useAgentDisputes(ens: string, query: Partial<DisputeListQuery> = {}) {
  return useQuery(agentDisputesOptions(ens, query));
}

export function useCreateDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDisputeInput): Promise<Dispute> => tribuneClient.createDispute(input),
    onSuccess: (dispute) => {
      qc.invalidateQueries({ queryKey: disputeKeys.all });
      qc.setQueryData(disputeKeys.detail(dispute.id), dispute);
    },
  });
}

export function useAddEvidence(disputeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddEvidenceInput): Promise<Evidence> =>
      tribuneClient.addEvidence(disputeId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: disputeKeys.detail(disputeId) });
    },
  });
}
