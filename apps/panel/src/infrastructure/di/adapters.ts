import path from 'node:path';

import { DirectTxAdapter } from '../../adapters/execution/direct-tx.adapter';
import { LogOnlyExecutionAdapter } from '../../adapters/execution/log-only.adapter';
import { MemoryIdentityAdapter } from '../../adapters/identity/memory.adapter';
import { ReadonlyEnsAdapter } from '../../adapters/identity/readonly-ens.adapter';
import { OgComputeAdapter } from '../../adapters/inference/og-compute.adapter';
import { ReplayAdapter } from '../../adapters/inference/replay.adapter';
import { StubLlmAdapter } from '../../adapters/inference/stub-llm.adapter';
import { FilesystemStorageAdapter } from '../../adapters/storage/filesystem.adapter';
import { MemoryStorageAdapter } from '../../adapters/storage/memory.adapter';
import { OgStorageAdapter } from '../../adapters/storage/og-storage.adapter';
import { AdjudicationService } from '../../domain/adjudication.service';
import type { Clock } from '../../domain/ports/clock.port';
import type { ExecutionPort } from '../../domain/ports/execution.port';
import type { IdentityPort } from '../../domain/ports/identity.port';
import type { InferencePort } from '../../domain/ports/inference.port';
import type { DomainLogger } from '../../domain/ports/logger.port';
import type { StoragePort } from '../../domain/ports/storage.port';
import { SystemClock } from '../clock/system-clock';
import type { PanelConfig } from '../config/config.schema';

export interface AdjudicationFactoryOutput {
  service: AdjudicationService;
  inference: InferencePort;
  storage: StoragePort;
  execution: ExecutionPort;
  identity: IdentityPort;
}

export interface AdjudicationFactoryDeps {
  config: PanelConfig;
  logger: DomainLogger;
  clock?: Clock;
}

export function buildAdjudication(deps: AdjudicationFactoryDeps): AdjudicationFactoryOutput {
  switch (deps.config.appProfile) {
    case 'test':
      return buildTest(deps);
    case 'replay':
      return buildReplay(deps, false);
    case 'demo':
      return buildReplay(deps, true);
    case 'local':
      return buildLocal(deps);
  }
}

function buildTest(deps: AdjudicationFactoryDeps): AdjudicationFactoryOutput {
  const clock = deps.clock ?? new SystemClock();
  const inference = new StubLlmAdapter();
  const storage = new MemoryStorageAdapter();
  const execution = new LogOnlyExecutionAdapter(deps.logger);
  const identity = new MemoryIdentityAdapter();
  const service = new AdjudicationService(
    inference,
    storage,
    execution,
    identity,
    clock,
    deps.logger,
  );
  return { service, inference, storage, execution, identity };
}

function buildReplay(deps: AdjudicationFactoryDeps, frozen: boolean): AdjudicationFactoryOutput {
  const clock = deps.clock ?? new SystemClock();
  // No funded key → use the deterministic stub directly (no replay wrapper). This
  // keeps `pnpm dev:demo` runnable without 0G credentials: judges and CI get
  // identical stub verdicts without a "frozen replay miss" error.
  const inference: InferencePort = deps.config.privateKey
    ? new ReplayAdapter({
        inner: new OgComputeAdapter({
          rpcUrl: deps.config.ogRpcUrl,
          privateKey: deps.config.privateKey,
          logger: deps.logger,
        }),
        fixturesDir: path.resolve(deps.config.fixturesDir),
        frozen,
      })
    : new StubLlmAdapter();
  const storage = deps.config.privateKey
    ? new OgStorageAdapter({
        rpcUrl: deps.config.ogRpcUrl,
        indexerUrl: deps.config.ogStorageIndexerUrl,
        privateKey: deps.config.privateKey,
        logger: deps.logger,
      })
    : new FilesystemStorageAdapter(path.resolve(deps.config.fixturesDir, '.storage'));
  const execution = new DirectTxAdapter(
    {
      apiBaseUrl: deps.config.apiBaseUrl,
      sharedSecret: deps.config.sharedSecret,
    },
    deps.logger,
  );
  const identity = new ReadonlyEnsAdapter(deps.logger);
  const service = new AdjudicationService(
    inference,
    storage,
    execution,
    identity,
    clock,
    deps.logger,
  );
  return { service, inference, storage, execution, identity };
}

function buildLocal(deps: AdjudicationFactoryDeps): AdjudicationFactoryOutput {
  if (!deps.config.privateKey) {
    throw new Error(
      'APP_PROFILE=local requires PANEL_PRIVATE_KEY (a funded 0G testnet account). ' +
        'See apps/panel/SPIKE.md for the funding flow, or use APP_PROFILE=demo for replay.',
    );
  }
  const clock = deps.clock ?? new SystemClock();
  const og = new OgComputeAdapter({
    rpcUrl: deps.config.ogRpcUrl,
    privateKey: deps.config.privateKey,
    logger: deps.logger,
  });
  const inference = new ReplayAdapter({
    inner: og,
    fixturesDir: path.resolve(deps.config.fixturesDir),
    frozen: false,
  });
  const storage = new OgStorageAdapter({
    rpcUrl: deps.config.ogRpcUrl,
    indexerUrl: deps.config.ogStorageIndexerUrl,
    privateKey: deps.config.privateKey,
    logger: deps.logger,
  });
  const execution = new DirectTxAdapter(
    {
      apiBaseUrl: deps.config.apiBaseUrl,
      sharedSecret: deps.config.sharedSecret,
    },
    deps.logger,
  );
  const identity = new ReadonlyEnsAdapter(deps.logger);
  const service = new AdjudicationService(
    inference,
    storage,
    execution,
    identity,
    clock,
    deps.logger,
  );
  return { service, inference, storage, execution, identity };
}
