import type { DisputeOutcome, PanelistVerdict, VoteChoice } from './types/panel';

interface AggregateInput {
  panelists: PanelistVerdict[];
}

export interface AggregateResult {
  outcome: DisputeOutcome;
  votesFor: number;
  votesAgainst: number;
}

export class PanelVoteAggregator {
  aggregate({ panelists }: AggregateInput): AggregateResult {
    const voted = panelists.filter((p) => p.status === 'VOTED');
    if (voted.length === 0) {
      return { outcome: 'FAILED', votesFor: 0, votesAgainst: 0 };
    }

    const tally: Record<VoteChoice, number> = { REFUND: 0, REJECT: 0, ABSTAIN: 0 };
    for (const v of voted) tally[v.vote] += 1;

    const refunds = tally.REFUND;
    const rejects = tally.REJECT;
    const abstains = tally.ABSTAIN;

    if (refunds >= 2) {
      return { outcome: 'REFUND', votesFor: refunds, votesAgainst: rejects };
    }
    if (rejects >= 2) {
      return { outcome: 'REJECT', votesFor: rejects, votesAgainst: refunds };
    }
    if (refunds === 1 && rejects === 1) {
      // 1-1-1 split with an abstention: the abstain breaks toward REJECT (do no harm).
      // 1-1 with a missing/failed vote: same — preserve the status quo.
      return { outcome: 'REJECT', votesFor: rejects, votesAgainst: refunds };
    }
    if (refunds === 1 && abstains >= 1) {
      return { outcome: 'ABSTAIN', votesFor: 0, votesAgainst: 0 };
    }
    if (rejects === 1 && abstains >= 1) {
      return { outcome: 'REJECT', votesFor: rejects, votesAgainst: 0 };
    }
    if (abstains === voted.length) {
      return { outcome: 'ABSTAIN', votesFor: 0, votesAgainst: 0 };
    }
    // Single non-abstain vote with two failures — defer to that vote with low confidence.
    if (refunds === 1) return { outcome: 'REFUND', votesFor: 1, votesAgainst: 0 };
    if (rejects === 1) return { outcome: 'REJECT', votesFor: 1, votesAgainst: 0 };
    return { outcome: 'FAILED', votesFor: 0, votesAgainst: 0 };
  }
}
