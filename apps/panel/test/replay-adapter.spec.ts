import { computeFixtureKey, ReplayAdapter } from '../src/adapters/inference/replay.adapter';
import type {
  InferenceCall,
  InferencePort,
  InferenceResult,
} from '../src/domain/ports/inference.port';

class CountingInner implements InferencePort {
  calls = 0;
  constructor(private readonly result: InferenceResult) {}
  async listAvailableModels(): Promise<string[]> {
    return ['model-x'];
  }
  async runPanelist(): Promise<InferenceResult> {
    this.calls += 1;
    return this.result;
  }
}

function memFileOps(): {
  read(path: string): Promise<string>;
  write(path: string, body: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdirp(path: string): Promise<void>;
  store: Map<string, string>;
} {
  const store = new Map<string, string>();
  return {
    store,
    read: async (p) => {
      if (!store.has(p)) throw new Error(`miss ${p}`);
      return store.get(p)!;
    },
    write: async (p, body) => {
      store.set(p, body);
    },
    exists: async (p) => store.has(p),
    mkdirp: async () => undefined,
  };
}

const SAMPLE: InferenceCall = {
  modelName: 'model-x',
  systemPrompt: 'sys',
  userPrompt: 'user',
  maxTokens: 256,
  temperature: 0.2,
};

const RESULT: InferenceResult = {
  rawResponse: '{"vote":"REFUND","confidence":0.9,"reasoning":"…"}',
  promptTokens: 12,
  completionTokens: 16,
  latencyMs: 5,
  attestation: 'tee:verified',
};

describe('ReplayAdapter', () => {
  it('cache miss: calls inner, persists fixture, returns inner result', async () => {
    const inner = new CountingInner(RESULT);
    const fileOps = memFileOps();
    const adapter = new ReplayAdapter({
      inner,
      fixturesDir: '/fixtures',
      frozen: false,
      fileOps,
    });
    const result = await adapter.runPanelist(SAMPLE);
    expect(result).toEqual(RESULT);
    expect(inner.calls).toBe(1);
    expect(fileOps.store.size).toBe(1);
  });

  it('cache hit: does NOT call inner', async () => {
    const inner = new CountingInner(RESULT);
    const fileOps = memFileOps();
    const key = computeFixtureKey(SAMPLE);
    fileOps.store.set(`/fixtures/${key}.json`, JSON.stringify({ result: RESULT }));
    const adapter = new ReplayAdapter({
      inner,
      fixturesDir: '/fixtures',
      frozen: false,
      fileOps,
    });
    const result = await adapter.runPanelist(SAMPLE);
    expect(result).toEqual(RESULT);
    expect(inner.calls).toBe(0);
  });

  it('frozen + cache miss: throws InferenceError, never calls inner', async () => {
    const inner = new CountingInner(RESULT);
    const adapter = new ReplayAdapter({
      inner,
      fixturesDir: '/fixtures',
      frozen: true,
      fileOps: memFileOps(),
    });
    await expect(adapter.runPanelist(SAMPLE)).rejects.toMatchObject({
      code: 'inference_broker_unavailable',
    });
    expect(inner.calls).toBe(0);
  });
});
