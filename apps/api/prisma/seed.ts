import 'dotenv/config';

import {
  Prisma,
  PrismaClient,
  PanelVoteChoice,
  PanelVoteStatus,
  SettlementStepStatus,
  SettlementStepType,
} from '@prisma/client';

const prisma = new PrismaClient();

const PANELIST_MODELS = ['qwen3.6-plus', 'glm-5-fp8', 'llama-4-70b'] as const;
const SETTLEMENT_TYPES = [
  SettlementStepType.VERDICT_ONCHAIN,
  SettlementStepType.KEEPER_CLAIMED,
  SettlementStepType.FUNDS_RELEASED,
  SettlementStepType.ENS_REPUTATION,
] as const;

interface SettledFixture {
  status: 'SETTLED' | 'REJECTED';
  outcome: PanelVoteChoice;
  claimantEns: string;
  respondentEns: string;
  claimType: string;
  statement: string;
  amountUsdc: number;
  reasonings: [string, string, string];
  votes: [PanelVoteChoice, PanelVoteChoice, PanelVoteChoice];
  durationMs: number;
  costUsd: number;
  settlementTxs: [string, string, string, string];
}

const settledFixtures: SettledFixture[] = [
  {
    status: 'SETTLED',
    outcome: PanelVoteChoice.REFUND,
    claimantEns: 'integrator.verdikt.eth',
    respondentEns: 'oracle.fastfeed.eth',
    claimType: 'sla_breach',
    statement:
      'Oracle missed 4 of 30 publication windows. Pro-rata refund requested under SLA clause 7.',
    amountUsdc: 2_134,
    durationMs: 42_000,
    costUsd: 0.5,
    reasonings: [
      'SLA clause 7 commits to 30 publication windows in a 30-minute span. Logs show 26 of 30 windows hit. Refund proportionate to missed windows.',
      'Re-running the integrator\u2019s probe against the oracle endpoint reproduces the gap. The defect is on the producer side.',
      'Force-majeure invoked by the seller is procedurally barred — written notice was not posted within the contractually required window.',
    ],
    votes: [PanelVoteChoice.REFUND, PanelVoteChoice.REFUND, PanelVoteChoice.REFUND],
    settlementTxs: [
      '0xkeeper11aabb22ccdd33eeff44556677889900112233445566778899aabbccddee',
      '0xkeeper2200aabbccddeeff112233445566778899aabbccddeeff00aabbccddeeff',
      '0xuniswap11deadbeef22cafe33feed44ab55cd66ef778899aabbccddeeff00112233',
      '0xens0011223344aabbccddeeff5566778899001122334455667788',
    ],
  },
  {
    status: 'REJECTED',
    outcome: PanelVoteChoice.REJECT,
    claimantEns: 'merchant.verdikt.eth',
    respondentEns: 'agent42.verdikt.eth',
    claimType: 'wrong_amount',
    statement:
      'Buyer asserts a double-charge. On-chain trace shows a single settled payment of 420 USDC.',
    amountUsdc: 420,
    durationMs: 38_000,
    costUsd: 0.5,
    reasonings: [
      'Block-explorer trace cited by the buyer references nonce 0x14b6 — a single transaction. No duplicate transfer present.',
      'Wallet history shows two pending entries collapsing into one confirmed transfer. UI artefact, not a chain event.',
      'Procedural review confirms the buyer agreed to a single-charge invoice; no breach of contract.',
    ],
    votes: [PanelVoteChoice.REJECT, PanelVoteChoice.REJECT, PanelVoteChoice.REJECT],
    settlementTxs: [
      '0xkeeperej00aabbcc11ddeeff22334455667788990011223344556677',
      '0xkeeperej11aabbcc22ddeeff334455667788990011223344556677aa',
      '0xnoflow0000000000000000000000000000000000000000000000000000000000',
      '0xensej00112233445566778899aabbccddeeff112233445566',
    ],
  },
  {
    status: 'SETTLED',
    outcome: PanelVoteChoice.REFUND,
    claimantEns: 'desk.verdikt.eth',
    respondentEns: 'mm.makerflow.eth',
    claimType: 'service_not_delivered',
    statement:
      'Market-maker quoted reserved size, partial-filled at a worse price. Refund of slippage delta requested.',
    amountUsdc: 7_800,
    durationMs: 51_000,
    costUsd: 0.5,
    reasonings: [
      'RFQ flow file shows the quoted size 1.0 was filled at 0.62 — the reserved-quantity guarantee was breached.',
      'Reconstructed top-of-book confirms makerflow had inventory at the quoted price for 240ms; the partial-fill was a routing failure.',
      'The slippage delta between quoted and filled price is 1.4%, exceeding the 0.5% tolerance in the RFQ contract.',
    ],
    votes: [PanelVoteChoice.REFUND, PanelVoteChoice.REFUND, PanelVoteChoice.REFUND],
    settlementTxs: [
      '0xkeeperdsk001122334455667788990011223344556677889900aabb',
      '0xkeeperdsk11aabbccddeeff1122334455667788990011223344aabb',
      '0xuniswap0888aabbccddeeff112233445566778899',
      '0xensdsk00aabbccddeeff112233445566778899',
    ],
  },
];

async function clean(): Promise<void> {
  await prisma.settlementStep.deleteMany();
  await prisma.verdict.deleteMany();
  await prisma.panelVote.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.agentReputation.deleteMany();
}

async function seedSettled(fixture: SettledFixture, index: number): Promise<void> {
  const filedAt = new Date(Date.now() - (index + 1) * 86_400_000);
  const settledAt = new Date(filedAt.getTime() + fixture.durationMs);
  const dispute = await prisma.dispute.create({
    data: {
      status: fixture.status,
      claimantEns: fixture.claimantEns,
      respondentEns: fixture.respondentEns,
      claimType: fixture.claimType,
      statement: fixture.statement,
      txHash: `0xsettled${index}${'00'.padEnd(56, '0')}`.slice(0, 66),
      amountUsdc: new Prisma.Decimal(fixture.amountUsdc),
      arbitrationFee: new Prisma.Decimal(0.5),
      createdAt: filedAt,
      evidence: {
        create: [
          {
            filename: 'sow-v3.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 184_320,
            storageUri: `0g://storage/${cryptoUuid()}`,
          },
          {
            filename: 'output-trace.json',
            mimeType: 'application/json',
            sizeBytes: 41_900,
            storageUri: `0g://storage/${cryptoUuid()}`,
          },
        ],
      },
      panelVotes: {
        create: PANELIST_MODELS.map((model, i) => ({
          modelName: model,
          vote: fixture.votes[i] ?? PanelVoteChoice.ABSTAIN,
          confidence: new Prisma.Decimal(0.85 + i * 0.03),
          reasoning: fixture.reasonings[i] ?? '',
          status: PanelVoteStatus.VOTED,
        })),
      },
      settlementSteps: {
        create: SETTLEMENT_TYPES.map((step, i) => ({
          step,
          status: SettlementStepStatus.COMPLETED,
          txHash: fixture.settlementTxs[i] ?? null,
          startedAt: new Date(filedAt.getTime() + 5_000 + i * 8_000),
          completedAt: new Date(filedAt.getTime() + 12_000 + i * 8_000),
        })),
      },
    },
  });

  const refundCount = fixture.votes.filter((v) => v === PanelVoteChoice.REFUND).length;
  const rejectCount = fixture.votes.filter((v) => v === PanelVoteChoice.REJECT).length;
  const verdict = await prisma.verdict.create({
    data: {
      disputeId: dispute.id,
      outcome: fixture.outcome,
      votesFor: fixture.outcome === PanelVoteChoice.REFUND ? refundCount : rejectCount,
      votesAgainst: fixture.outcome === PanelVoteChoice.REFUND ? rejectCount : refundCount,
      totalDurationMs: fixture.durationMs,
      totalCostUsd: new Prisma.Decimal(fixture.costUsd),
      createdAt: settledAt,
    },
  });

  await Promise.all([
    bumpReputation(
      fixture.claimantEns,
      fixture.outcome === PanelVoteChoice.REFUND ? 'won' : 'lost',
      verdict.id,
    ),
    bumpReputation(
      fixture.respondentEns,
      fixture.outcome === PanelVoteChoice.REFUND ? 'lost' : 'won',
      verdict.id,
    ),
  ]);
}

async function seedActive(): Promise<void> {
  const filedAt = new Date(Date.now() - 30_000);
  const dispute = await prisma.dispute.create({
    data: {
      status: 'ADJUDICATING',
      claimantEns: 'buyer.verdikt.eth',
      respondentEns: 'forecaster.verdikt.eth',
      claimType: 'service_not_delivered',
      statement:
        'Forecast endpoint returned 3 daily entries; SOW article 2 requires a 7-entry array. Refund requested.',
      txHash: `0xactive00${'a'.repeat(58)}`.slice(0, 66),
      amountUsdc: new Prisma.Decimal(1_250),
      arbitrationFee: new Prisma.Decimal(0.5),
      createdAt: filedAt,
      evidence: {
        create: [
          {
            filename: 'sow-v3.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 184_320,
            storageUri: `0g://storage/${cryptoUuid()}`,
          },
          {
            filename: 'output-trace.json',
            mimeType: 'application/json',
            sizeBytes: 41_900,
            storageUri: `0g://storage/${cryptoUuid()}`,
          },
        ],
      },
      panelVotes: {
        create: [
          {
            modelName: 'qwen3.6-plus',
            vote: PanelVoteChoice.REFUND,
            confidence: new Prisma.Decimal(0.94),
            reasoning:
              'SOW article 2 specifies daily.length === 7. The respondent\u2019s payload validates against the buyer\u2019s schema with length 3. The defect is on the face of the response.',
            status: PanelVoteStatus.VOTED,
          },
          {
            modelName: 'glm-5-fp8',
            vote: PanelVoteChoice.REFUND,
            confidence: new Prisma.Decimal(0.91),
            reasoning:
              'Re-running the buyer\u2019s prompt against the seller\u2019s endpoint reproduces the 3-entry response. The schema requires a 7-day forecast; only 3 days were returned.',
            status: PanelVoteStatus.VOTED,
          },
          {
            modelName: 'llama-4-70b',
            vote: PanelVoteChoice.ABSTAIN,
            confidence: new Prisma.Decimal(0),
            reasoning: '',
            status: PanelVoteStatus.REASONING,
          },
        ],
      },
      settlementSteps: {
        create: SETTLEMENT_TYPES.map((step) => ({
          step,
          status: SettlementStepStatus.PENDING,
        })),
      },
    },
  });

  console.log(`Seeded active dispute ${dispute.id} with 2/3 votes in.`);
}

async function bumpReputation(
  ens: string,
  outcome: 'won' | 'lost',
  lastVerdictId: string,
): Promise<void> {
  await prisma.agentReputation.upsert({
    where: { ens },
    update: {
      totalDisputes: { increment: 1 },
      disputesWon: { increment: outcome === 'won' ? 1 : 0 },
      disputesLost: { increment: outcome === 'lost' ? 1 : 0 },
      lastVerdictId,
    },
    create: {
      ens,
      totalDisputes: 1,
      disputesWon: outcome === 'won' ? 1 : 0,
      disputesLost: outcome === 'lost' ? 1 : 0,
      frivolityIndex: new Prisma.Decimal(0.0),
      evidenceQualityScore: new Prisma.Decimal(0.0),
      lastVerdictId,
    },
  });
}

async function seedAgents(): Promise<void> {
  const extras = [
    {
      ens: 'auditor.zksec.eth',
      totalDisputes: 6,
      disputesWon: 5,
      disputesLost: 1,
      evidenceQualityScore: 8.4,
    },
    {
      ens: 'creator91.eth',
      totalDisputes: 2,
      disputesWon: 1,
      disputesLost: 1,
      evidenceQualityScore: 5.2,
    },
  ];
  for (const a of extras) {
    await prisma.agentReputation.upsert({
      where: { ens: a.ens },
      update: {},
      create: {
        ens: a.ens,
        totalDisputes: a.totalDisputes,
        disputesWon: a.disputesWon,
        disputesLost: a.disputesLost,
        frivolityIndex: new Prisma.Decimal(0.05),
        evidenceQualityScore: new Prisma.Decimal(a.evidenceQualityScore),
      },
    });
  }
}

function cryptoUuid(): string {
  return globalThis.crypto.randomUUID();
}

async function main(): Promise<void> {
  await clean();
  for (const [i, fixture] of settledFixtures.entries()) {
    await seedSettled(fixture, i);
  }
  await seedActive();
  await seedAgents();

  console.log(
    `Seed complete: ${settledFixtures.length} settled, 1 adjudicating, ${
      settledFixtures.length * 2 + 2
    } reputation rows.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
