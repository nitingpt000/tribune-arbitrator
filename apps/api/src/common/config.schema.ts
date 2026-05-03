import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  API_PORT: Joi.number().integer().default(3001),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  WEB_ORIGIN: Joi.string().uri().default('http://localhost:3000'),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),
  APP_PROFILE: Joi.string().valid('local', 'demo', 'test', 'replay').default('test'),
  PANEL_SERVICE_URL: Joi.string().uri().default('http://localhost:3002'),
  TRIBUNE_PANEL_SHARED_SECRET: Joi.string().default('dev-only-change-me'),
  // Phase 4: contract addresses surfaced via /info; null when no deployment
  ARBITRATOR_ADDRESS: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  PANEL_REGISTRY_ADDRESS: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  EXAMPLE_ESCROW_ADDRESS: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  SETTLEMENT_TOKEN_ADDRESS: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  CHAIN_ID: Joi.number().integer().default(16601),
  EXPLORER_BASE_URL: Joi.string().uri().default('https://chainscan-galileo.0g.ai'),
});
