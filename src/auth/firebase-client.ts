'use client'

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'

import { firebaseWebConfig } from '@/config/client-env'

/**
 * The browser-side Firebase app.
 *
 * Initialised lazily and guarded by `getApps()` so that a fast-refresh reload
 * reuses the existing app instead of throwing `duplicate-app`.
 *
 * Nothing here is a security boundary. The client SDK's job is to obtain an ID
 * token; every route handler independently verifies that token with the Admin
 * SDK before doing any work (`src/auth/verify-token.ts`).
 */
function firebaseApp(): FirebaseApp {
  return getApps().length > 0 ? getApp() : initializeApp(firebaseWebConfig())
}

export function firebaseAuth(): Auth {
  return getAuth(firebaseApp())
}

/**
 * The current user's ID token, or `null` when nobody is signed in.
 *
 * The SDK refreshes the token transparently when it is close to expiring, so
 * this is called immediately before each request rather than cached.
 */
export async function currentIdToken(): Promise<string | null> {
  const user = firebaseAuth().currentUser
  return user ? user.getIdToken() : null
}
