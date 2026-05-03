import type {
  Dispute,
  DisputeStatus,
  DisputeSummary,
  PanelVote,
  PanelVoteChoice,
} from '@tribune/types';

export const CLAIM_TYPE_LABELS: Record<string, string> = {
  service_not_delivered: 'Service not delivered',
  sla_breach: 'SLA breach',
  wrong_amount: 'Wrong amount',
  data_breach: 'Data breach',
  misrepresentation: 'Misrepresentation',
  other: 'Other',
};

export const claimTypeLabel = (key: string): string => CLAIM_TYPE_LABELS[key] ?? key;

export const shortDisputeId = (id: string): string =>
  `TRB-${id.replace(/-/g, '').slice(0, 4).toUpperCase()}`;

export const TERMINAL_STATUSES = new Set<DisputeStatus>(['SETTLED', 'REJECTED']);

export function isTerminal(d: { status: DisputeStatus }): boolean {
  return TERMINAL_STATUSES.has(d.status);
}

export function votePerspective(
  ens: string,
  dispute: Pick<DisputeSummary, 'claimantEns' | 'respondentEns'>,
): 'mine' | 'counterparty' | undefined {
  if (dispute.claimantEns === ens) return 'mine';
  if (dispute.respondentEns === ens) return 'counterparty';
  return undefined;
}

export function panelVotesByModel(dispute: Pick<Dispute, 'panelVotes'>): Map<string, PanelVote> {
  const m = new Map<string, PanelVote>();
  for (const v of dispute.panelVotes) m.set(v.modelName, v);
  return m;
}

export const VOTE_CHOICE_LABEL: Record<PanelVoteChoice, string> = {
  REFUND: 'refund',
  REJECT: 'reject',
  ABSTAIN: 'abstain',
};
