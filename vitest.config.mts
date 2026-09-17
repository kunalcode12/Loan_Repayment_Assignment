import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Resolves the `@/*` alias straight from tsconfig.json, so tests import
  // exactly the same specifiers the application does.
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // The integration tests share one Postgres database. Running files in
    // parallel would interleave their transactions, so they are serialised.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
