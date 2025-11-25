import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'src/auth/**',
      'src/utils/shutdown.ts',
      'src/middleware/security.ts',
      'src/middleware/api-docs.ts',
      'src/core/realtime-manager.ts',
      'src/core/intelligent-cache.ts',
      'src/core/openapi-converter.ts',
      'src/core/performance-optimizer.ts',
      'src/core/advanced-metrics.ts',
      'src/services/enhanced-stateset-client.ts',
      'src/tools/ai-insights.ts',
      'src/tools/openapi-tools.ts',
      'src/tools/enhanced-tools.ts',
    ],
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['src/**/*.ts', 'tests/**/*.ts'],
  })),
  prettierConfig,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
      },
    },
    plugins: {
      prettier,
    },
    rules: {
      // Override TypeScript rules
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // General rules
      'no-console': 'warn',
      'no-debugger': 'error',
      'prefer-const': 'warn',
      'no-var': 'error',
      'no-case-declarations': 'off',

      // Prettier integration
      'prettier/prettier': 'error',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
];