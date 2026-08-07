import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import security from 'eslint-plugin-security';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from 'typescript-eslint';
import local from './eslint-rules/single-line-comments.js';

// Lint standard ported from Parallel Five's luminariah (Jared's config) — the
// shared P5 standard. One deviation: luminaria bans direct client DB writes
// (RPC-only architecture); YardLedger writes through its service layer by design,
// so that rule is omitted.
export default tseslint.config(
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      'coverage/',
      '.expo/',
      'web-build/',
      'supabase/',
      'eslint-rules/',
      '.playwright-mcp/',
      'eslint.config.mjs',
      '**/*.config.js',
      '**/*.config.cjs',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  prettier,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    plugins: {
      'unused-imports': unusedImports,
      security,
      sonarjs,
      unicorn,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      local,
    },
  },

  {
    files: ['src/**/*.{ts,tsx}', 'App.tsx', 'index.{ts,tsx}'],
    rules: {
      // ── Complexity guardrails ──
      complexity: ['error', 20],
      'max-depth': ['error', 4],
      'max-lines-per-function': [
        'error',
        { max: 300, skipBlankLines: true, skipComments: true },
      ],
      'max-params': ['error', 6],
      'no-nested-ternary': 'error',

      // ── Naming conventions ──
      '@typescript-eslint/naming-convention': [
        'warn',
        {
          selector: 'default',
          format: ['camelCase', 'PascalCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
          leadingUnderscore: 'allow',
        },
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
        {
          selector: 'parameter',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'parameter',
          format: ['PascalCase'],
          filter: { regex: '^[A-Z]', match: true },
        },
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['UPPER_CASE', 'PascalCase'] },
        {
          selector: 'objectLiteralProperty',
          format: null,
          filter: { regex: '_', match: true },
        },
        {
          selector: 'typeProperty',
          format: null,
          filter: { regex: '_', match: true },
        },
      ],

      // ── TypeScript strict rules ──
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true },
      ],
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',

      // ── Unused imports ──
      'unused-imports/no-unused-imports': 'error',

      // ── General quality ──
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      'prefer-template': 'error',
      'object-shorthand': 'error',

      // ── Security ──
      'security/detect-object-injection': 'off',
      'security/detect-unsafe-regex': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-possible-timing-attacks': 'error',
      'security/detect-pseudoRandomBytes': 'error',

      // ── SonarJS ──
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-collapsible-if': 'error',
      'sonarjs/prefer-immediate-return': 'error',
      'sonarjs/no-redundant-boolean': 'error',
      'sonarjs/prefer-single-boolean-return': 'error',

      // ── Unicorn (cherry-picked) ──
      'unicorn/catch-error-name': 'error',
      'unicorn/error-message': 'error',
      'unicorn/throw-new-error': 'error',
      'unicorn/better-regex': 'error',
      'unicorn/explicit-length-check': 'error',
      'unicorn/new-for-builtins': 'error',
      'unicorn/no-instanceof-array': 'error',
      'unicorn/no-new-array': 'error',
      'unicorn/no-thenable': 'error',
      'unicorn/no-unnecessary-await': 'error',
      'unicorn/no-useless-spread': 'error',
      'unicorn/no-useless-promise-resolve-reject': 'error',
      'unicorn/prefer-array-find': 'error',
      'unicorn/prefer-array-flat-map': 'error',
      'unicorn/prefer-array-some': 'error',
      'unicorn/prefer-includes': 'error',
      'unicorn/prefer-string-starts-ends-with': 'error',
      'unicorn/prefer-type-error': 'error',
      'unicorn/no-null': 'off',
      'unicorn/no-array-reduce': 'off',
      'unicorn/no-array-for-each': 'off',
      'unicorn/prefer-top-level-await': 'off',

      // ── React ──
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'react-refresh/only-export-components': [
        'error',
        { allowConstantExport: true },
      ],

      // ── Comments (CLAUDE.md: single-line only) ──
      'local/single-line-comments': 'error',
    },
  },

  // ── ADOPTION BACKLOG (2026-07-30) ────────────────────────────
  // Part of the standard (error, above) but the existing code has violations,
  // so these run at WARN until each is burned down to zero and promoted back to
  // error. Deliberately in plain sight — NOT a hidden suppressions baseline.
  // Remove a rule here once its count hits 0. Counts at adoption:
  // single-line-comments 392 · no-unnecessary-type-conversion 151 · no-unsafe-*
  // ~280 · no-nested-ternary 89 · no-floating-promises 62 · max-lines 28 ·
  // complexity 26 (overlaps #126).
  {
    files: ['src/**/*.{ts,tsx}', 'App.tsx', 'index.{ts,tsx}'],
    rules: {
      'local/single-line-comments': 'warn',
      'no-nested-ternary': 'warn',
      complexity: 'warn',
      'max-lines-per-function': 'warn',
      'max-depth': 'warn',
      '@typescript-eslint/no-unnecessary-type-conversion': 'warn',
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-enum-comparison': 'warn',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/switch-exhaustiveness-check': 'warn',
      '@typescript-eslint/no-base-to-string': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/restrict-plus-operands': 'warn',
      '@typescript-eslint/no-deprecated': 'warn',
      '@typescript-eslint/no-redundant-type-constituents': 'warn',
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'warn',
      '@typescript-eslint/prefer-promise-reject-errors': 'warn',
      '@typescript-eslint/no-invalid-void-type': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/only-throw-error': 'warn',
      'react-refresh/only-export-components': 'warn',
      'security/detect-unsafe-regex': 'warn',
      'security/detect-possible-timing-attacks': 'warn',
      'sonarjs/no-collapsible-if': 'warn',
      'unicorn/prefer-array-some': 'warn',
      'unicorn/no-new-array': 'warn',
    },
  },

  // Platform files are typed by their platform's tsconfig, not the default
  // project — disable type-aware rules there (tsc remains the type gate).
  {
    files: ['**/*.native.{ts,tsx}', '**/*.web.{ts,tsx}'],
    ...tseslint.configs.disableTypeChecked,
  },

  // Test files: relax a few rules the suites legitimately need.
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', 'src/**/__tests__/**'],
    rules: {
      'max-lines-per-function': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  // E2E harness + tooling config live outside the app's tsconfig project and
  // talk to untyped external data (the pg client, the browser), so type-aware
  // rules can't resolve there — disable them (tsc doesn't cover these anyway).
  {
    files: ['e2e/**/*.ts', 'playwright.config.ts'],
    ...tseslint.configs.disableTypeChecked,
  }
);
