import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'

import { firebaseAdminCredentials } from '@/config/server-env'

/**
 * The Firebase Admin app, initialised once per process.
 *
 * `getApps()` is checked first because a dev-server hot reload re-evaluates this
 * module, and initialising a second app with the same name throws.
 */
const APP_NAME = 'loan-repayment-service'

function adminApp(): App {
  const existing = getApps().find((app) => app.name === APP_NAME)
  if (existing) return existing

  const credentials = firebaseAdminCredentials()

  return initializeApp(
    {
      credential: cert({
        projectId: credentials.projectId,
        clientEmail: credentials.clientEmail,
        privateKey: credentials.privateKey,
      }),
      projectId: credentials.projectId,
    },
    APP_NAME,
  )
}

export function adminAuth(): Auth {
  return getAuth(adminApp())
}
