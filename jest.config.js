/** @type {import('jest').Config} */
module.exports = {
  clearMocks: true,
  restoreMocks: true,
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  collectCoverageFrom: [
    '<rootDir>/src/config/**/*.ts',
    '<rootDir>/src/theme/**/*.ts',
    '<rootDir>/src/utils/**/*.ts',
    '<rootDir>/src/services/**/*.ts',
    '!<rootDir>/src/**/*.d.ts',
    '!<rootDir>/src/**/__tests__/**',
    '!<rootDir>/src/**/index.ts',
    // Avoid unit-coverage noise for entrypoints/integration-heavy modules.
    '!<rootDir>/src/app.ts',
    '!<rootDir>/src/supabaseClient.ts',
    '!<rootDir>/src/services/SupabaseService.ts',
    '!<rootDir>/src/services/SyncQueue.ts',
    '!<rootDir>/src/services/BatchSaveService.ts',
    '!<rootDir>/src/services/DirtyTracker.ts',
    '!<rootDir>/src/services/cacheWarmup.ts',
  ],
  coverageDirectory: '<rootDir>/test-results/coverage',
  coverageReporters: ['text', 'html', 'lcov'],
};
