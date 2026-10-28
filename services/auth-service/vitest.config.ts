import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/setup-env.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // Integration test files share auth_db_test, so they must not run in parallel.
    fileParallelism: false,
  },
});
