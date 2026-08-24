/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  globalSetup: '<rootDir>/test/globalSetup.ts',
  globalTeardown: '<rootDir>/test/globalTeardown.ts',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  // Un seul Postgres partage : les workers paralleles se marcheraient dessus
  // au TRUNCATE de chaque test.
  maxWorkers: 1,
  testTimeout: 30000,
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
};
