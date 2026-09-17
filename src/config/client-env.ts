/**
 * Public Firebase configuration.
 *
 * These values are not secrets — the Firebase Web SDK ships them to the browser
 * by design — but they still must not be committed, so they come from the
 * environment. Each one is referenced as a full `process.env.NEXT_PUBLIC_*`
 * literal because that is what Next.js statically replaces at build time;
 * dynamic lookups such as `process.env[name]` would be left as `undefined`.
 */

export interface FirebaseWebConfig {
  apiKey: string
  authDomain: string
  projectId: string
  appId: string
  storageBucket?: string
  messagingSenderId?: string
}

const rawConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
}

const REQUIRED_KEYS = ['apiKey', 'authDomain', 'projectId', 'appId'] as const

/** Names of the required variables that are missing, for a helpful UI message. */
export function missingFirebaseWebConfigKeys(): string[] {
  const envNames: Record<(typeof REQUIRED_KEYS)[number], string> = {
    apiKey: 'NEXT_PUBLIC_FIREBASE_API_KEY',
    authDomain: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    projectId: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    appId: 'NEXT_PUBLIC_FIREBASE_APP_ID',
  }
  return REQUIRED_KEYS.filter((key) => !rawConfig[key]).map((key) => envNames[key])
}

export function isFirebaseWebConfigured(): boolean {
  return missingFirebaseWebConfigKeys().length === 0
}

export function firebaseWebConfig(): FirebaseWebConfig {
  const missing = missingFirebaseWebConfigKeys()
  if (missing.length > 0) {
    throw new Error(`Firebase web configuration is incomplete. Missing: ${missing.join(', ')}`)
  }
  return rawConfig as FirebaseWebConfig
}
