import { AppError } from '@/lib/errors'

/**
 * Turn a driver-level database failure into an actionable error.
 *
 * Without this, every misconfiguration — unreachable host, wrong password,
 * schema never migrated — surfaces identically as an opaque 500, and the only
 * way to tell them apart is to go and read the server logs. That is a poor
 * experience on a fresh deployment, which is exactly when these failures
 * happen.
 *
 * Every message below names the *class* of problem and the fix. None of them
 * echoes the connection string, the host, the credentials or a stack trace, so
 * nothing sensitive reaches the client. The full error is still logged.
 */

/** Postgres SQLSTATE codes worth distinguishing. */
const UNDEFINED_TABLE = '42P01'
const INVALID_PASSWORD = '28P01'
const INVALID_AUTHORIZATION = '28000'
const UNDEFINED_DATABASE = '3D000'
const TOO_MANY_CONNECTIONS = '53300'
const CANNOT_CONNECT_NOW = '57P03'

/** Node socket-level failures. */
const UNREACHABLE = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'EAI_AGAIN',
  'ECONNRESET',
  'EPIPE',
])

function codeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const { code } = error as { code?: unknown }
  return typeof code === 'string' ? code : undefined
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Returns an `AppError` when the failure is recognisably a database problem,
 * or `null` to let the caller fall through to a generic 500.
 */
export function describeDatabaseError(error: unknown): AppError | null {
  const code = codeOf(error)
  const message = messageOf(error)

  if (code === UNDEFINED_TABLE) {
    return new AppError(
      'SERVICE_UNAVAILABLE',
      'The database schema has not been created. Run the documented setup step (`npm run db:setup`) against the database this deployment points at.',
    )
  }

  if (code === INVALID_PASSWORD || code === INVALID_AUTHORIZATION) {
    return new AppError(
      'SERVICE_UNAVAILABLE',
      'The database rejected the credentials in DATABASE_URL. Check the password, and remember that a password with special characters must be URL-encoded.',
    )
  }

  if (code === UNDEFINED_DATABASE) {
    return new AppError(
      'SERVICE_UNAVAILABLE',
      'DATABASE_URL points at a database that does not exist.',
    )
  }

  if (code === TOO_MANY_CONNECTIONS || code === CANNOT_CONNECT_NOW) {
    return new AppError(
      'SERVICE_UNAVAILABLE',
      'The database is not accepting new connections. On a serverless platform, use a pooled connection string rather than a direct one.',
    )
  }

  if (code !== undefined && UNREACHABLE.has(code)) {
    return new AppError(
      'SERVICE_UNAVAILABLE',
      'The database could not be reached. Check that DATABASE_URL is set for this environment and that it is the pooled connection string — a direct Supabase endpoint is IPv6-only and is unreachable from most serverless platforms.',
    )
  }

  // `node-postgres` reports a pool timeout as a plain Error with no code.
  if (/connection terminated due to connection timeout|timeout exceeded when trying to connect/i.test(message)) {
    return new AppError(
      'SERVICE_UNAVAILABLE',
      'Timed out connecting to the database. Check that DATABASE_URL is set for this environment and that the host is reachable from it.',
    )
  }

  if (/self.signed certificate|certificate/i.test(message)) {
    return new AppError(
      'SERVICE_UNAVAILABLE',
      'The database TLS handshake failed. Set DATABASE_SSL=disable only for a local PostgreSQL without TLS.',
    )
  }

  return null
}
