import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    maxWorkers: process.env.CI ? undefined : '25%',
    environment: 'node',
    testTimeout: 20_000,
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['**/*.integration.test.ts', '**/node_modules/**'],
    clearMocks: true,
    restoreMocks: true,
  },
});
