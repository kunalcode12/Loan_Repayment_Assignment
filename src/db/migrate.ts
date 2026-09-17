import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { getPool, withTransaction } from './client'

/**
 * Schema setup.
 *
 * The schema is created by running the `.sql` files in `src/db/migrations` in
 * filename order. Nothing is ever applied by hand. Applied migrations are
 * recorded in `schema_migrations` together with a checksum of the file, so:
 *
 * - re-running is a no-op (the command is safe to run on every deploy), and
 * - editing a migration that has already run is caught rather than ignored.
 *
 * All pending migrations run inside a single transaction guarded by a Postgres
 * advisory lock, so concurrent runners are serialised and a failure part-way
 * through leaves the schema exactly as it was.
 */

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations')
const ADVISORY_LOCK_KEY = 0x10_a4_7e_51

export interface MigrationResult {
  applied: string[]
  skipped: string[]
}

interface MigrationFile {
  name: string
  sql: string
  checksum: string
}

async function loadMigrations(): Promise<MigrationFile[]> {
  const entries = await readdir(MIGRATIONS_DIR)
  const files = entries.filter((name) => name.endsWith('.sql')).sort()

  return Promise.all(
    files.map(async (name) => {
      const sql = await readFile(join(MIGRATIONS_DIR, name), 'utf8')
      return {
        name,
        sql,
        // Line endings are normalised so a Windows checkout and a Linux CI run
        // agree on the checksum.
        checksum: createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex'),
      }
    }),
  )
}

export async function runMigrations(
  log: (message: string) => void = () => {},
): Promise<MigrationResult> {
  const migrations = await loadMigrations()
  const pool = getPool()

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        TEXT        PRIMARY KEY,
      checksum    TEXT        NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  return withTransaction(async (client) => {
    // A transaction-scoped advisory lock, rather than a session-scoped one, so
    // this works through Supabase's transaction pooler as well as a direct
    // connection. It is released automatically at COMMIT or ROLLBACK.
    await client.query('SELECT pg_advisory_xact_lock($1)', [ADVISORY_LOCK_KEY])

    const { rows } = await client.query<{ name: string; checksum: string }>(
      'SELECT name, checksum FROM schema_migrations',
    )
    const alreadyApplied = new Map(rows.map((row) => [row.name, row.checksum]))

    const applied: string[] = []
    const skipped: string[] = []

    for (const migration of migrations) {
      const existingChecksum = alreadyApplied.get(migration.name)

      if (existingChecksum !== undefined) {
        if (existingChecksum !== migration.checksum) {
          throw new Error(
            `Migration ${migration.name} has already been applied but its contents have changed. ` +
              'Add a new migration file instead of editing an applied one.',
          )
        }
        skipped.push(migration.name)
        continue
      }

      await client.query(migration.sql)
      await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [
        migration.name,
        migration.checksum,
      ])

      log(`applied ${migration.name}`)
      applied.push(migration.name)
    }

    return { applied, skipped }
  })
}
