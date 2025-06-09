/**
 * ESLint config untuk proyek NestJS (TypeScript + ESM + Prettier).
 * Aktifkan JSDoc saat dibutuhkan.
 * Run: `npx eslint . --fix`
 */
import eslint from '@eslint/js';
import parser from '@typescript-eslint/parser';
import tseslint from '@typescript-eslint/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import prettierPlugin from 'eslint-plugin-prettier';
import jsdocPlugin from 'eslint-plugin-jsdoc';
import jestPlugin from 'eslint-plugin-jest';
import globals from 'globals';

const enableJSDoc = false; // Ubah jadi `true` jika ingin mengaktifkan JSDoc

export default [
  {
    ignores: [
      'prisma/generated/**',
      'prisma/migrations/**',
      'dist/',
      'node_modules/',
      'coverage/',
      'public/',
    ],
  },

  eslint.configs.recommended,

  {
    files: ['**/*.{js,ts,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts'],
      },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.eslint.json',
        },
        node: {
          extensions: ['.js', '.ts', '.cjs'],
        },
      },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },

  {
    files: ['**/*.ts'],
    languageOptions: {
      parser,
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      import: importPlugin,
    },
    rules: {
      ...tseslint.configs['recommended'].rules,
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', disallowTypeAnnotations: false },
      ],
      'import/no-unresolved': ['error', { commonjs: true, amd: true }],
      'import/no-duplicates': 'error',
      'import/extensions': [
        'error',
        'ignorePackages',
        {
          ts: 'never',
          js: 'never',
          cjs: 'never',
          mjs: 'never',
          json: 'always',
        },
      ],
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
          pathGroups: [
            { pattern: '@nestjs/**', group: 'external', position: 'before' },
            { pattern: 'ali-oss', group: 'external', position: 'after' },
            {
              pattern: '@{storage,exceptions,auth,i18n}/*',
              group: 'internal',
              position: 'after',
            },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
        },
      ],
    },
  },

  {
    files: ['test/**/*.{ts,cjs}'],
    plugins: {
      jest: jestPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      ...jestPlugin.configs['recommended'].rules,
      'jest/no-standalone-expect': 'off', // Nonaktifkan untuk fleksibilitas
      'jest/expect-expect': 'warn', // Jadikan peringatan untuk fleksibilitas
    },
  },

  {
    files: ['jest.config.ts', 'eslint.config.js'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      ...(enableJSDoc ? {} : { 'jsdoc/require-jsdoc': 'off' }),
    },
  },

  {
    files: ['test/**/*.__mocks__/*.{ts,cjs}'],
    rules: {
      ...(enableJSDoc ? {} : { 'jsdoc/require-jsdoc': 'off' }),
    },
  },

  {
    files: ['**/*.{js,ts,cjs}'],
    plugins: { prettier: prettierPlugin },
    rules: {
      'prettier/prettier': ['error', {}, { usePrettierrc: true }],
    },
  },

  enableJSDoc && {
    files: ['**/*.{js,ts,cjs}'],
    plugins: { jsdoc: jsdocPlugin },
    rules: {
      ...jsdocPlugin.configs.recommended.rules,
      'jsdoc/require-jsdoc': [
        'warn',
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
          },
        },
      ],
    },
  },
].filter(Boolean); // filter Boolean untuk skip config `false`
