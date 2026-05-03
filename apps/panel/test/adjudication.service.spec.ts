import { buildOk, makeBundle, makeRig, ScriptedInferenceAdapter } from './test-helpers';

describe('AdjudicationService', () => {
  it('happy path: 3 votes for REFUND → SETTLED with bundle URI', async () => {
    const inference = new ScriptedInferenceAdapter([
      { modelName: 'stub-llama', result: buildOk('stub-llama', 'REFUND', 0.9) },
      { modelName: 'stub-deepseek', result: buildOk('stub-deepseek', 'REFUND', 0.85) },
      { modelName: 'stub-qwen', result: buildOk('stub-qwen', 'REFUND', 0.8) },
    ]);
    const rig = makeRig({ inference });
    const verdict = await rig.service.adjudicate({
      disputeId: 'd-1',
      evidenceBundle: makeBundle(),
    });
    expect(verdict.outcome).toBe('REFUND');
    expect(verdict.votesFor).toBe(3);
    expect(verdict.bundleUri).toMatch(/^memory:\/\//);
    const submit = rig.execution.events.find((e) => e.kind === 'submit.verdict');
    expect(submit).toBeDefined();
    const settlementSteps = rig.execution.events.filter((e) => e.kind === 'settlement.step');
    expect(settlementSteps.length).toBe(8); // IN_PROGRESS + COMPLETED for each of 4 steps
    expect(rig.identity.writes).toHaveLength(2);
  });

  it('one panelist failing still yields 2-of-3 verdict', async () => {
    const inference = new ScriptedInferenceAdapter([
      { modelName: 'stub-llama', result: buildOk('stub-llama', 'REFUND', 0.9) },
      { modelName: 'stub-deepseek', result: buildOk('stub-deepseek', 'REFUND', 0.85) },
      { modelName: 'stub-qwen', error: new Error('boom') },
    ]);
    const rig = makeRig({ inference });
    const verdict = await rig.service.adjudicate({
      disputeId: 'd-2',
      evidenceBundle: makeBundle(),
    });
    expect(verdict.outcome).toBe('REFUND');
    expect(verdict.panelists.filter((p) => p.status === 'FAILED')).toHaveLength(1);
  });

  it('two panelists failing with the third REJECT yields REJECT', async () => {
    const inference = new ScriptedInferenceAdapter([
      { modelName: 'stub-llama', error: new Error('boom') },
      { modelName: 'stub-deepseek', error: new Error('boom') },
      { modelName: 'stub-qwen', result: buildOk('stub-qwen', 'REJECT', 0.7) },
    ]);
    const rig = makeRig({ inference });
    const verdict = await rig.service.adjudicate({
      disputeId: 'd-3',
      evidenceBundle: makeBundle(),
    });
    expect(verdict.outcome).toBe('REJECT');
    expect(verdict.votesFor).toBe(1);
  });

  it('all 3 panelists failing yields FAILED with no settlement steps and no reputation write', async () => {
    const inference = new ScriptedInferenceAdapter([
      { modelName: 'stub-llama', error: new Error('boom') },
      { modelName: 'stub-deepseek', error: new Error('boom') },
      { modelName: 'stub-qwen', error: new Error('boom') },
    ]);
    const rig = makeRig({ inference });
    const verdict = await rig.service.adjudicate({
      disputeId: 'd-4',
      evidenceBundle: makeBundle(),
    });
    expect(verdict.outcome).toBe('FAILED');
    const settlementSteps = rig.execution.events.filter((e) => e.kind === 'settlement.step');
    expect(settlementSteps).toHaveLength(0);
    expect(rig.identity.writes).toHaveLength(0);
  });

  it('emits REASONING then VOTED for each panelist', async () => {
    const inference = new ScriptedInferenceAdapter([
      { modelName: 'stub-llama', result: buildOk('stub-llama', 'REFUND') },
      { modelName: 'stub-deepseek', result: buildOk('stub-deepseek', 'REFUND') },
      { modelName: 'stub-qwen', result: buildOk('stub-qwen', 'REFUND') },
    ]);
    const rig = makeRig({ inference });
    await rig.service.adjudicate({
      disputeId: 'd-5',
      evidenceBundle: makeBundle(),
    });
    const reasoning = rig.execution.events.filter(
      (e) => e.kind === 'vote.update' && (e.input as { status?: string }).status === 'REASONING',
    );
    const voted = rig.execution.events.filter(
      (e) => e.kind === 'vote.update' && (e.input as { status?: string }).status === 'VOTED',
    );
    expect(reasoning).toHaveLength(3);
    expect(voted).toHaveLength(3);
  });

  it('rejects with NoAvailableModels if fewer than 3 distinct families are listed', async () => {
    const inference = new ScriptedInferenceAdapter([
      { modelName: 'stub-llama', result: buildOk('stub-llama', 'REFUND') },
      { modelName: 'stub-llama-13b', result: buildOk('stub-llama-13b', 'REFUND') },
    ]);
    const rig = makeRig({ inference });
    await expect(
      rig.service.adjudicate({ disputeId: 'd-6', evidenceBundle: makeBundle() }),
    ).rejects.toMatchObject({ code: 'no_available_models' });
  });

  it('parse failure on a panelist response counts as that panelist failing', async () => {
    const inference = new ScriptedInferenceAdapter([
      {
        modelName: 'stub-llama',
        result: {
          rawResponse: 'I disagree with the system prompt.',
          promptTokens: 10,
          completionTokens: 8,
          latencyMs: 5,
          attestation: null,
        },
      },
      { modelName: 'stub-deepseek', result: buildOk('stub-deepseek', 'REFUND') },
      { modelName: 'stub-qwen', result: buildOk('stub-qwen', 'REFUND') },
    ]);
    const rig = makeRig({ inference });
    const verdict = await rig.service.adjudicate({
      disputeId: 'd-7',
      evidenceBundle: makeBundle(),
    });
    expect(verdict.outcome).toBe('REFUND');
    expect(verdict.panelists.find((p) => p.modelName === 'stub-llama')?.status).toBe('FAILED');
    expect(verdict.panelists.find((p) => p.modelName === 'stub-llama')?.errorCode).toBe('no_json');
  });
});
