/**
 * Konfigurasi Jest untuk proyek NestJS dengan TypeScript dan ES Modules.
 * @see https://jestjs.io/docs/configuration
 */
import { pathsToModuleNameMapper } from 'ts-jest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Dapatkan path absolut ke tsconfig.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const tsconfigPath = `${__dirname}/tsconfig.json`;

// Baca dan parse tsconfig.json
const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf8'));
const { compilerOptions } = tsconfig;

export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  testRegex: '\\.(spec|test)\\.(ts|js)$',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  transform: {
    '^.+\\.(ts|js)$': [
      'ts-jest',
      {
        tsconfig: './tsconfig.json',
        diagnostics: false,
        useESM: true,
      },
    ],
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    ...pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/' }),
    '^fs$': '<rootDir>/test/file-upload/providers/local-storage/__mocks__/fs.cjs',
    '^fs/promises$': '<rootDir>/test/file-upload/providers/local-storage/__mocks__/fs.cjs',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!memfs|graceful-fs|unionfs|fs-extra)/',
  ],
  setupFilesAfterEnv: ['<rootDir>/test/config/jest.setup.js'],
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.spec.{ts,js}',
    '!src/**/*.test.{ts,js}',
    '!src/**/generated/**',
    '!src/**/migrations/**',
    '!src/main.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/test/',
    '/dist/',
    '/prisma/generated/',
    '/public/',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  maxWorkers: '50%',
  maxConcurrency: 5,
  clearMocks: true,
  resetMocks: true,
  testTimeout: 60000,
};