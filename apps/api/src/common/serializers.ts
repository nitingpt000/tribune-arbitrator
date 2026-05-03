import type {
  AgentReputation as PrismaAgentReputation,
  Dispute as PrismaDispute,
  Evidence as PrismaEvidence,
  PanelVote as PrismaPanelVote,
  Prisma,
  SettlementStep as PrismaSettlementStep,
  Verdict as PrismaVerdict,
} from '@prisma/client';
import type {
  AgentReputation,
  Dispute,
  DisputeSummary,
  Evidence,
  PanelVote,
  SettlementStep,
  Verdict,
} from '@tribune/types';

const toNumber = (value: Prisma.Decimal | number): number =>
  typeof value === 'number' ? value : value.toNumber();

export function serializeEvidence(row: PrismaEvidence): Evidence {
  return {
    id: row.id,
    disputeId: row.disputeId,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    storageUri: row.storageUri,
    createdAt: row.createdAt,
  };
}

export function serializePanelVote(row: PrismaPanelVote): PanelVote {
  return {
    id: row.id,
    disputeId: row.disputeId,
    modelName: row.modelName,
    vote: row.vote,
    confidence: toNumber(row.confidence),
    reasoning: row.reasoning,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function serializeVerdict(row: PrismaVerdict): Verdict {
  return {
    id: row.id,
    disputeId: row.disputeId,
    outcome: row.outcome,
    votesFor: row.votesFor,
    votesAgainst: row.votesAgainst,
    totalDurationMs: row.totalDurationMs,
    totalCostUsd: toNumber(row.totalCostUsd),
    createdAt: row.createdAt,
  };
}

export function serializeSettlementStep(row: PrismaSettlementStep): SettlementStep {
  return {
    id: row.id,
    disputeId: row.disputeId,
    step: row.step,
    status: row.status,
    txHash: row.txHash,
    detail: row.detail,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
  };
}

export interface DisputeWithRelations extends PrismaDispute {
  evidence: PrismaEvidence[];
  panelVotes: PrismaPanelVote[];
  verdict: PrismaVerdict | null;
  settlementSteps: PrismaSettlementStep[];
}

export function serializeDispute(row: DisputeWithRelations): Dispute {
  return {
    id: row.id,
    status: row.status,
    claimantEns: row.claimantEns,
    respondentEns: row.respondentEns,
    claimType: row.claimType,
    statement: row.statement,
    txHash: row.txHash,
    amountUsdc: toNumber(row.amountUsdc),
    arbitrationFee: toNumber(row.arbitrationFee),
    evidence: row.evidence.map(serializeEvidence),
    panelVotes: row.panelVotes.map(serializePanelVote),
    verdict: row.verdict ? serializeVerdict(row.verdict) : null,
    settlementSteps: row.settlementSteps.map(serializeSettlementStep),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export interface DisputeSummaryRow extends PrismaDispute {
  verdict: PrismaVerdict | null;
  _count: { evidence: number; panelVotes: number };
}

export function serializeDisputeSummary(row: DisputeSummaryRow): DisputeSummary {
  return {
    id: row.id,
    status: row.status,
    claimantEns: row.claimantEns,
    respondentEns: row.respondentEns,
    claimType: row.claimType,
    statement: row.statement,
    amountUsdc: toNumber(row.amountUsdc),
    txHash: row.txHash,
    evidenceCount: row._count.evidence,
    votesCastCount: row._count.panelVotes,
    verdict: row.verdict ? serializeVerdict(row.verdict) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function serializeAgentReputation(row: PrismaAgentReputation): AgentReputation {
  return {
    ens: row.ens,
    totalDisputes: row.totalDisputes,
    disputesWon: row.disputesWon,
    disputesLost: row.disputesLost,
    frivolityIndex: toNumber(row.frivolityIndex),
    evidenceQualityScore: toNumber(row.evidenceQualityScore),
    lastVerdictId: row.lastVerdictId,
    updatedAt: row.updatedAt,
  };
}
