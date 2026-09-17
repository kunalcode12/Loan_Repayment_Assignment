import { AppError } from '@/lib/errors'
import { adminAuth } from './firebase-admin'

export interface AuthenticatedUser {
  uid: string
  email: string | null
}

/**
 * Verify a Firebase ID token **on the server**.
 *
 * The client SDK's own notion of "signed in" is not evidence of anything: a
 * request can be made with any string in the header. `verifyIdToken` checks the
 * token's RS256 signature against Google's published public keys, its issuer and
 * audience against this project, and its expiry — none of which a caller can
 * forge. Every one of the three route handlers goes through here.
 *
 * `checkRevoked` is left off deliberately: it costs a round trip to the Firebase
 * backend on every request, and with short-lived (one hour) ID tokens and no
 * per-user data in this service, the trade-off is not worth it. Enabling it is a
 * one-word change if revocation latency ever matters.
 */
export async function verifyIdToken(idToken: string): Promise<AuthenticatedUser> {
  try {
    const decoded = await adminAuth().verifyIdToken(idToken)
    return { uid: decoded.uid, email: decoded.email ?? null }
  } catch (error) {
    if (error instanceof AppError) throw error
    throw AppError.unauthenticated('The supplied authentication token is invalid or has expired.')
  }
}
