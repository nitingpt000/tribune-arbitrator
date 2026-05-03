import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { AppModule } from '../../app.module';
import { ProblemDetailsFilter } from '../../common/problem-details.filter';
import { PrismaService } from '../../prisma/prisma.service';
import { MockPanelService } from '../panel/mock-panel.service';

describe('Disputes integration (live DB)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new ProblemDetailsFilter());

    const panel = app.get(MockPanelService);
    panel.setPhasesForTests({
      preAdjudicationMs: 5,
      perVoteMinReasoningMs: 1,
      perVoteMaxReasoningMs: 2,
      settlementStepMs: {
        VERDICT_ONCHAIN: 1,
        KEEPER_CLAIMED: 1,
        FUNDS_RELEASED: 1,
        ENS_REPUTATION: 1,
      },
    });

    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /disputes creates a dispute, panel runs, GET /disputes/:id ends in SETTLED|REJECTED', async () => {
    const created = await request(app.getHttpServer())
      .post('/disputes')
      .send({
        claimantEns: 'jest.test.eth',
        respondentEns: 'jest.peer.eth',
        claimType: 'service_not_delivered',
        statement: 'Integration test dispute statement of at least 20 chars.',
        txHash: '0x' + 'b'.repeat(64),
        amountUsdc: 12.5,
      })
      .expect(201);

    expect(created.body.id).toBeDefined();
    expect(created.body.status).toBe('PENDING');

    const id = created.body.id as string;
    const deadline = Date.now() + 8_000;
    let final: { status: string } | null = null;
    while (Date.now() < deadline) {
      const res = await request(app.getHttpServer()).get(`/disputes/${id}`).expect(200);
      if (res.body.status === 'SETTLED' || res.body.status === 'REJECTED') {
        final = res.body;
        break;
      }
      await new Promise((r) => setTimeout(r, 80));
    }

    expect(final).toBeTruthy();
    expect(['SETTLED', 'REJECTED']).toContain(final!.status);

    const detail = await request(app.getHttpServer()).get(`/disputes/${id}`).expect(200);
    expect(detail.body.verdict).toBeTruthy();
    expect(detail.body.panelVotes).toHaveLength(3);
    for (const v of detail.body.panelVotes) expect(v.status).toBe('VOTED');
  }, 15_000);

  it('GET /disputes/stats returns the expected shape', async () => {
    const res = await request(app.getHttpServer()).get('/disputes/stats').expect(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        total: expect.any(Number),
        active: expect.any(Number),
        settled: expect.any(Number),
        refundedUsdc: expect.any(Number),
        avgSettlementSeconds: expect.any(Number),
        avgCostUsd: expect.any(Number),
      }),
    );
  });

  it('cleans up the test dispute', async () => {
    await prisma.dispute.deleteMany({ where: { claimantEns: 'jest.test.eth' } });
  });
});
