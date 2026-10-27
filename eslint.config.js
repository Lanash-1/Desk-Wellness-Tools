import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'dev-dist',
      'coverage',
      'node_modules',
      'src-tauri/target',
      'src-tauri/gen',
      'playwright-report',
      'test-results',
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // src/core is pure TypeScript: no React, no DOM framework, no platform SDKs, no database.
    // This keeps the scheduler/stats logic unit-testable and portable.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-*', 'react/*'], message: 'src/core must not import React.' },
            { group: ['@tauri-apps/*'], message: 'src/core must not import Tauri APIs.' },
            { group: ['dexie', 'dexie-*'], message: 'src/core must not import Dexie.' },
            { group: ['zustand', 'zustand/*'], message: 'src/core must not import Zustand.' },
            {
              group: [
                '@/platform',
                '@/platform/*',
                '@/storage',
                '@/storage/*',
                '@/store/*',
                '@/features/*',
                '@/components/*',
              ],
            },
          ],
        },
      ],
    },
  },
);
