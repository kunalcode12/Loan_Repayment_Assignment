import { AppError } from '@/lib/errors'

/**
 * Server-side environment access.
 *
 * Nothing here is prefixed `NEXT_PUBLIC_`, so none of these values can be
 * inlined into a client bundle; this module is imported only by route handlers,
 * repositories and the CLI scripts.
 *
 * Values are read lazily rather than at module load so that importing a module
 * (for example in a unit test that never touches the database) does not require
 * the whole environment to be present. A missing variable produces a 503 with
 * the variable name, which is far easier to act on than a driver-level crash.
 */

function read(name: string): string {
  const value = process.env[name]
  if (value === undefined || value.trim() === '') {
    throw new AppError(
      'SERVICE_UNAVAILABLE',
      `Environment variable ${name} is not set. Copy .env.example to .env.local and fill it in.`,
    )
  }
  return value.trim()
}

function readOptional(name: string): string | undefined {
  const value = process.env[name]
  return value === undefined || value.trim() === '' ? undefined : value.trim()
}

export function databaseUrl(): string {
  return read('DATABASE_URL')
}

export interface FirebaseAdminCredentials {
  projectId: string
  clientEmail: string
  privateKey: string
}

export function firebaseAdminCredentials(): FirebaseAdminCredentials {
  return {
    projectId: read('FIREBASE_PROJECT_ID'),
    clientEmail: read('FIREBASE_CLIENT_EMAIL'),
    // Private keys are stored on one line with literal `\n` sequences because
    // most secret stores (Vercel included) do not accept embedded newlines.
    privateKey: read('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
  }
}

/**
 * Supabase's pooled connection presents a certificate that is not in the Node
 * trust store by default. `DATABASE_SSL=disable` covers a plain local Postgres.
 */
export function databaseSslMode(): 'require' | 'disable' {
  return readOptional('DATABASE_SSL') === 'disable' ? 'disable' : 'require'
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}
