import { loadEnv } from './load-env'

loadEnv()

// Imported after `loadEnv()` so the pool reads a populated environment.
const { runMigrations } = await import('@/db/migrate')
const { closePool } = await import('@/db/client')

/**
 * `npm run db:setup`
 *
 * Creates the schema from `src/db/migrations`. Safe to run repeatedly: already
 * applied migrations are skipped.
 */
async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
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

try {
  await main()
} catch (error) {
  console.error('\nDatabase setup failed:')
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await closePool()
}
