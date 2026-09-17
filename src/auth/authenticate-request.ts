import { AppError } from '@/lib/errors'
import { verifyIdToken, type AuthenticatedUser } from './verify-token'

const BEARER_PREFIX = /^Bearer\s+(.+)$/i

/**
 * Extract and verify the caller's Firebase ID token.
 *
 * The header is read off the `Request` object rather than through `headers()`
 * from `next/headers`, which keeps route handlers callable directly from the
 * integration tests without a Next.js request context.
 */
export async function authenticateRequest(request: Request): Promise<AuthenticatedUser> {
  const header = request.headers.get('authorization')

  if (!header) {
    throw AppError.unauthenticated('Missing Authorization header. Sign in and retry with a Firebase ID token.')
  }

  const match = BEARER_PREFIX.exec(header.trim())
  const token = match?.[1]?.trim()

  if (!token) {
    throw AppError.unauthenticated('Authorization header must be of the form "Bearer <firebase-id-token>".')
  }

  return verifyIdToken(token)
}
