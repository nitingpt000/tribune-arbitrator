import globals from 'globals';

import baseConfig from './base.js';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...baseConfig,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-function': 'off',
      // NestJS relies on emitDecoratorMetadata: imports used by decorators
      // (DI tokens, DTOs annotated with @Body, etc.) must remain value imports.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
];
