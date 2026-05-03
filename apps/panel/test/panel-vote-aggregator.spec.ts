import { PanelVoteAggregator } from '../src/domain/panel-vote-aggregator';
import type { PanelistVerdict } from '../src/domain/types/panel';

const VOTED = (modelName: string, vote: 'REFUND' | 'REJECT' | 'ABSTAIN'): PanelistVerdict => ({
  modelName,
  vote,
  confidence: 0.8,
  reasoning: 'reason',
  status: 'VOTED',
  rawResponse: '{}',
  attestation: null,
  latencyMs: 10,
  promptTokens: 0,
  completionTokens: 0,
});

const FAILED = (modelName: string): PanelistVerdict => ({
  modelName,
  vote: 'ABSTAIN',
  confidence: 0,
  reasoning: '',
  status: 'FAILED',
  rawResponse: '',
  attestation: null,
  latencyMs: 0,
  promptTokens: 0,
  completionTokens: 0,
});

describe('PanelVoteAggregator', () => {
  const agg = new PanelVoteAggregator();

  it('3 REFUND → REFUND 3-0', () => {
    expect(
      agg.aggregate({
        panelists: [VOTED('a', 'REFUND'), VOTED('b', 'REFUND'), VOTED('c', 'REFUND')],
      }),
    ).toEqual({ outcome: 'REFUND', votesFor: 3, votesAgainst: 0 });
  });

  it('2 REFUND + 1 REJECT → REFUND 2-1', () => {
    expect(
      agg.aggregate({
        panelists: [VOTED('a', 'REFUND'), VOTED('b', 'REFUND'), VOTED('c', 'REJECT')],
      }),
    ).toEqual({ outcome: 'REFUND', votesFor: 2, votesAgainst: 1 });
  });

  it('2 REJECT + 1 REFUND → REJECT 2-1', () => {
    expect(
      agg.aggregate({
        panelists: [VOTED('a', 'REJECT'), VOTED('b', 'REJECT'), VOTED('c', 'REFUND')],
      }),
    ).toEqual({ outcome: 'REJECT', votesFor: 2, votesAgainst: 1 });
  });

  it('1 REFUND + 1 REJECT + 1 ABSTAIN → REJECT (preserve status quo on tie)', () => {
    expect(
      agg.aggregate({
        panelists: [VOTED('a', 'REFUND'), VOTED('b', 'REJECT'), VOTED('c', 'ABSTAIN')],
      }),
    ).toEqual({ outcome: 'REJECT', votesFor: 1, votesAgainst: 1 });
  });

  it('all FAILED → outcome FAILED', () => {
    expect(agg.aggregate({ panelists: [FAILED('a'), FAILED('b'), FAILED('c')] })).toEqual({
      outcome: 'FAILED',
      votesFor: 0,
      votesAgainst: 0,
    });
  });

  it('1 REFUND + 2 FAILED → REFUND with single vote', () => {
    expect(agg.aggregate({ panelists: [VOTED('a', 'REFUND'), FAILED('b'), FAILED('c')] })).toEqual({
      outcome: 'REFUND',
      votesFor: 1,
      votesAgainst: 0,
    });
  });

  it('1 ABSTAIN + 1 REJECT + 1 FAILED → REJECT', () => {
    expect(
      agg.aggregate({ panelists: [VOTED('a', 'ABSTAIN'), VOTED('b', 'REJECT'), FAILED('c')] }),
    ).toEqual({ outcome: 'REJECT', votesFor: 1, votesAgainst: 0 });
  });
});
