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
});
