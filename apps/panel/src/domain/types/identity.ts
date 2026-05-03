export interface AgentReputation {
  ens: string;
  address?: string;
  totalDisputes: number;
  disputesWon: number;
  disputesLost: number;
}

export interface ReputationDelta {
  outcome: 'won' | 'lost' | 'cancelled';
  reason: 'verdict_for' | 'verdict_against' | 'frivolous' | 'failed_panel';
  verdictBundleUri: string;
}
