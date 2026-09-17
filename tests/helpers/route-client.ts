import { NextRequest } from 'next/server'

const ORIGIN = 'http://localhost:3000'

/** The token the mocked verifier in the integration suite accepts. */
export const TEST_ID_TOKEN = 'test-firebase-id-token'

export interface Envelope<T> {
  status: number
  body: {
    data?: T
    error?: { code: string; message: string; issues?: { field: string; message: string }[] }
    requestId: string
  }
}

interface RequestOptions {
  method?: string
  body?: unknown
  /** Omit to send the request with no Authorization header at all. */
  token?: string | null
}


export function buildRequest(path: string, options: RequestOptions = {}): NextRequest {
  const { method = 'GET', body, token = TEST_ID_TOKEN } = options

  const headers = new Headers({ 'content-type': 'application/json' })
  if (token !== null) {
    headers.set('authorization', `Bearer ${token}`)
  }

  return new NextRequest(`${ORIGIN}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

export async function readEnvelope<T>(response: Response): Promise<Envelope<T>> {
  return { status: response.status, body: await response.json() }
}

/** Unwrap a successful envelope, failing loudly with the error if it is not. */
export function expectData<T>(envelope: Envelope<T>): T {
  if (!envelope.body.data) {
    throw new Error(
      `Expected a success envelope but got ${envelope.status}: ${JSON.stringify(envelope.body.error)}`,
    )
  }
  return envelope.body.data
}
