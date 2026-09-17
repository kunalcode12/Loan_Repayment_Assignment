'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'

import { isFirebaseWebConfigured, missingFirebaseWebConfigKeys } from '@/config/client-env'
import { firebaseAuth } from './firebase-client'

export type AuthStatus = 'loading' | 'signed-in' | 'signed-out' | 'unconfigured'

interface AuthContextValue {
  status: AuthStatus
  user: User | null
  /** Names of the missing `NEXT_PUBLIC_FIREBASE_*` variables, when unconfigured. */
  missingConfig: string[]
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Holds the browser's authentication state.
 *
 * Note what this does *not* do: it never decides whether a request is allowed.
 * It knows who is signed in so the UI can show the right screen and attach an ID
 * token; the server decides everything else.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isFirebaseWebConfigured()
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>(configured ? 'loading' : 'unconfigured')

  useEffect(() => {
    if (!configured) return

    const auth = firebaseAuth()
    // Keep the session across reloads so a refresh does not sign the user out.
    void setPersistence(auth, browserLocalPersistence)

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setStatus(nextUser ? 'signed-in' : 'signed-out')
    })
  }, [configured])

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await run(() => signInWithEmailAndPassword(firebaseAuth(), email, password))
  }, [])

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    await run(() => createUserWithEmailAndPassword(firebaseAuth(), email, password))
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    await run(() => signInWithPopup(firebaseAuth(), provider))
  }, [])

  const signOut = useCallback(async () => {
    await run(() => firebaseSignOut(firebaseAuth()))
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      missingConfig: configured ? [] : missingFirebaseWebConfigKeys(),
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signOut,
    }),
    [status, user, configured, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.')
  }
  return context
}

/**
 * Run a Firebase call, translating its error codes into something a person can
 * act on. Firebase's own messages read like `Firebase: Error
 * (auth/invalid-credential).`, which is not a useful thing to put on screen.
 */
async function run(action: () => Promise<unknown>): Promise<void> {
  try {
    await action()
  } catch (error) {
    throw new Error(describeAuthError(error))
  }
}

export function describeAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : ''

  switch (code) {
    case 'auth/invalid-email':
      return 'That email address is not valid.'
    case 'auth/missing-password':
      return 'Enter a password.'
    case 'auth/weak-password':
      return 'Choose a password of at least six characters.'
    case 'auth/email-already-in-use':
      return 'An account already exists for that email. Sign in instead.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Those credentials do not match an account.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment and try again.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'The Google sign-in window was closed before it finished.'
    case 'auth/popup-blocked':
      return 'The browser blocked the Google sign-in window. Allow pop-ups and retry.'
    case 'auth/operation-not-allowed':
      return 'That sign-in method is not enabled for this Firebase project.'
    case 'auth/network-request-failed':
      return 'Could not reach Firebase. Check the network connection.'
    default:
      return error instanceof Error && error.message
        ? error.message
        : 'Sign-in failed. Please try again.'
  }
}
