import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist', '.scratch'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/jsx-no-target-blank': 'off',
      // This codebase does not use propTypes anywhere. Leaving the rule on
      // produced ~116 errors that buried real ones (four genuine no-undef
      // errors once hid in that noise), so it is off by choice, not neglect.
      'react/prop-types': 'off',
      // Apostrophes in ordinary UI copy ("yesterday's trades") are fine.
      'react/no-unescaped-entities': 'off',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    // Server-side only: the Vercel function, its helpers, and the Vite config
    // run in Node, so they get Node globals (process, Buffer) instead.
    files: ['api/**/*.js', 'server/**/*.js', 'scripts/**/*.{js,mjs}', 'tests/**/*.js', 'vite.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
  },
  {
    files: ['src/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{
        group: ['**/server/**', '**/api/**', 'node:*'],
        message: 'Browser modules use HTTP clients; server implementations stay in server/ and api/.',
      }] }],
    },
  },
  {
    files: ['api/**/*.js', 'server/**/*.js'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{
        group: ['**/src/features/**', '**/src/platform/**', '**/src/app/**', '**/src/shared/**'],
        message: 'Server modules use server implementations and pure shared/domain code, never browser modules.',
      }] }],
    },
  },
  {
    files: ['src/domain/**/*.js', 'shared/**/*.js'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{
        group: ['react', 'react-dom', 'react-dom/**', '@supabase/**', 'node:*', '**/features/**', '**/platform/**', '**/app/**', '**/server/**', '**/api/**', '**/src/shared/**'],
        message: 'Domain and cross-runtime modules stay independent of React, storage, and host adapters.',
      }] }],
    },
  },
  {
    files: ['src/platform/**/*.js', 'src/shared/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{
        group: ['**/features/**', '**/app/**', '**/server/**', '**/api/**', 'node:*'],
        message: 'Browser infrastructure and shared UI cannot depend on feature or application modules.',
      }] }],
    },
  },
]
