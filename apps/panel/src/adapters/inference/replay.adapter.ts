import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { InferenceError } from '../../domain/errors';
import type {
  InferenceCall,
  InferencePort,
  InferenceResult,
} from '../../domain/ports/inference.port';

export interface ReplayAdapterOptions {
  inner: InferencePort;
  fixturesDir: string;
  frozen: boolean;
  // Optional override for tests; defaults to fs.
  fileOps?: {
    read(path: string): Promise<string>;
    write(path: string, body: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    mkdirp(path: string): Promise<void>;
  };
}

interface FixtureFile {
  schemaVersion: 1;
  modelName: string;
  hashedKey: string;
  result: InferenceResult;
}

export class ReplayAdapter implements InferencePort {
  constructor(private readonly options: ReplayAdapterOptions) {}

  listAvailableModels(): Promise<string[]> {
    return this.options.inner.listAvailableModels();
  }

  async runPanelist(input: InferenceCall): Promise<InferenceResult> {
    const key = computeFixtureKey(input);
    const filePath = path.join(this.options.fixturesDir, `${key}.json`);
    const fileOps = this.options.fileOps ?? defaultFileOps();

    if (await fileOps.exists(filePath)) {
      const body = await fileOps.read(filePath);
      const parsed = JSON.parse(body) as FixtureFile;
      return parsed.result;
    }

    if (this.options.frozen) {
      throw new InferenceError(
        'broker_unavailable',
        `Replay frozen and no fixture for ${input.modelName} (key=${key.slice(0, 12)}...)`,
        { modelName: input.modelName, key, fixturesDir: this.options.fixturesDir },
      );
    }

    const result = await this.options.inner.runPanelist(input);
    await fileOps.mkdirp(this.options.fixturesDir);
    const fixture: FixtureFile = {
      schemaVersion: 1,
      modelName: input.modelName,
      hashedKey: key,
      result,
    };
    await fileOps.write(filePath, JSON.stringify(fixture, null, 2));
    return result;
  }
}

export function computeFixtureKey(input: InferenceCall): string {
  const h = createHash('sha256');
  h.update(input.modelName);
  h.update('\u241F');
  h.update(input.systemPrompt);
  h.update('\u241F');
  h.update(input.userPrompt);
  h.update('\u241F');
  h.update(String(input.maxTokens));
  h.update('\u241F');
  h.update(String(input.temperature));
  return h.digest('hex').slice(0, 32);
}

function defaultFileOps(): NonNullable<ReplayAdapterOptions['fileOps']> {
  return {
    read: (p) => fs.readFile(p, 'utf8'),
    write: (p, body) => fs.writeFile(p, body, 'utf8'),
    async exists(p) {
      try {
        await fs.access(p);
        return true;
      } catch {
        return false;
      }
    },
    mkdirp: (p) => fs.mkdir(p, { recursive: true }).then(() => undefined),
  };
}
