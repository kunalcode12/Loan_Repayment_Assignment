import { Pool, types, type PoolClient, type QueryResultRow } from 'pg'

import { databaseSslMode, databaseUrl } from '@/config/server-env'

/**
 * Postgres access.
 *
 * Two type parsers are overridden before any pool is created, because both
 * defaults are actively wrong for this service:
 *
 * - `DATE` (OID 1082) is parsed by `pg` into a JavaScript `Date` at local
 *   midnight, which shifts a due date by a day for anyone west of UTC. We keep
 *   the raw `YYYY-MM-DD` string instead.
 * - `NUMERIC` (OID 1700) is parsed into a float, which would defeat the point of
 *   integer money. Nothing monetary is stored as `NUMERIC` here, but the parser
 *   is pinned to a string so that a future column cannot silently become a
 *   float.
 *
 * `BIGINT` (OID 20) already comes back as a string in `pg`; `paiseFromDb`
 * validates and widens it.
 */
types.setTypeParser(types.builtins.DATE, (value) => value)
types.setTypeParser(types.builtins.NUMERIC, (value) => value)

const POOL_KEY = Symbol.for('loan-repayment-service.pg-pool')

type GlobalWithPool = typeof globalThis & { [POOL_KEY]?: Pool }

function createPool(): Pool {
  return new Pool({
    connectionString: databaseUrl(),
    // Supabase's pooled endpoint terminates TLS with a certificate chain that
    // is not in the Node trust store, so verification is relaxed while the
    // connection itself stays encrypted. A plain local Postgres sets
    // DATABASE_SSL=disable.
    ssl: databaseSslMode() === 'disable' ? false : { rejectUnauthorized: false },
    // Serverless functions each hold their own pool, so it is kept small.
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // A runaway query must not pin a connection for the life of the function.
    statement_timeout: 15_000,
  })
}

/**
 * One pool per process, cached on `globalThis` so that a dev-server hot reload
 * does not leak a new pool (and a new set of connections) on every edit.
 */
export function getPool(): Pool {
  const globalWithPool = globalThis as GlobalWithPool
  if (!globalWithPool[POOL_KEY]) {
    globalWithPool[POOL_KEY] = createPool()
  }
  return globalWithPool[POOL_KEY]
}

export async function query<T extends QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params as unknown[])
  return result.rows
}

/**
 * Run `fn` inside a single transaction, committing on success and rolling back
 * on any thrown error. Every write path in this service goes through here, so a
 * failed payment can never leave allocations half-applied.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // The connection is already broken; releasing it below discards it.
    }
    throw error
  } finally {
    client.release()
  }
}

/** Used by scripts and the test harness so the process can exit cleanly. */
export async function closePool(): Promise<void> {
  const globalWithPool = globalThis as GlobalWithPool
  const pool = globalWithPool[POOL_KEY]
  if (pool) {
    delete globalWithPool[POOL_KEY]
    await pool.end()
  }
}
