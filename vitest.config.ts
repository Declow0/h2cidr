import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    exclude: ['test/online/**'],
    environment: 'node',
    pool: 'forks',
    testTimeout: 30_000,
  },
});
