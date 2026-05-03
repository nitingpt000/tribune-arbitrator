import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  APP_PROFILE: Joi.string().valid('test', 'local', 'demo', 'replay').default('test'),
  PANEL_PORT: Joi.number().integer().default(3002),
  TRIBUNE_API_URL: Joi.string().uri().default('http://localhost:3001'),
  TRIBUNE_PANEL_SHARED_SECRET: Joi.string().default('dev-only-change-me'),
  OG_RPC_URL: Joi.string().uri().default('https://evmrpc-testnet.0g.ai'),
  OG_STORAGE_INDEXER_URL: Joi.string().uri().default('https://indexer-storage-testnet-turbo.0g.ai'),
  PANEL_PRIVATE_KEY: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{64}$/)
    .optional()
    .messages({ 'string.pattern.base': 'PANEL_PRIVATE_KEY must be a 0x-prefixed 32-byte hex' }),
  PANEL_FIXTURES_DIR: Joi.string().default('./fixtures'),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),
});

export interface PanelConfig {
  appProfile: 'test' | 'local' | 'demo' | 'replay';
  port: number;
  apiBaseUrl: string;
  sharedSecret: string;
  ogRpcUrl: string;
  ogStorageIndexerUrl: string;
  privateKey: string | null;
  fixturesDir: string;
}

export function readPanelConfig(env: NodeJS.ProcessEnv = process.env): PanelConfig {
  return {
    appProfile: (env.APP_PROFILE as PanelConfig['appProfile']) ?? 'test',
    port: Number(env.PANEL_PORT ?? 3002),
    apiBaseUrl: env.TRIBUNE_API_URL ?? 'http://localhost:3001',
    sharedSecret: env.TRIBUNE_PANEL_SHARED_SECRET ?? 'dev-only-change-me',
    ogRpcUrl: env.OG_RPC_URL ?? 'https://evmrpc-testnet.0g.ai',
    ogStorageIndexerUrl:
      env.OG_STORAGE_INDEXER_URL ?? 'https://indexer-storage-testnet-turbo.0g.ai',
    privateKey: env.PANEL_PRIVATE_KEY ?? null,
    fixturesDir: env.PANEL_FIXTURES_DIR ?? './fixtures',
  };
}
