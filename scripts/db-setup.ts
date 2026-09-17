import { loadEnv } from './load-env'

loadEnv()

import { closePool } from '@/db/client'
import { runMigrations } from '@/db/migrate'

/**
 * `npm run db:setup`
 *
 * Creates the schema from `src/db/migrations`. Safe to run repeatedly: already
 * applied migrations are skipped.
 *
 * `loadEnv()` runs before anything touches the database. Imports are hoisted
 * above it, which is harmless here because every module reads its configuration
 * lazily — the pool is not constructed until the first query.
 */
async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    // `--skip-if-unconfigured` is used by the Vercel build, where migrating on
    // deploy is desirable but a build without database secrets (a preview from
    // a fork, for instance) should still succeed. Run interactively, a missing
    // DATABASE_URL is a setup mistake and fails loudly.
    if (process.argv.includes('--skip-if-unconfigured')) {
      console.warn('DATABASE_URL is not set — skipping migrations.')
      return
    }
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.')
  }

  console.log('Applying database migrations...')
  const { applied, skipped } = await runMigrations((message) => console.log(`  ${message}`))

  if (applied.length === 0) {
    console.log(`Schema is already up to date (${skipped.length} migration(s) previously applied).`)
  } else {
    console.log(`Applied ${applied.length} migration(s). Schema is ready.`)
  }
}

main()
  .catch((error: unknown) => {
    console.error('\nDatabase setup failed:')
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => closePool())
