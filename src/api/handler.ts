import { randomUUID } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { ZodError } from 'zod'

import { authenticateRequest } from '@/auth/authenticate-request'
import type { AuthenticatedUser } from '@/auth/verify-token'
import { AppError, isAppError } from '@/lib/errors'
import { failure } from './responses'

/**
 * The single entry point every route handler is wrapped in.
 *
 * It does three things, in this order, so that no handler has to repeat them
 * and no handler can forget one:
 *
 * 1. assigns a request id, echoed on every response and attached to every log
 *    line, so a user-reported failure can be found in the logs;
 * 2. **authenticates the caller** — the handler body does not run at all for an
 *    unauthenticated request;
 * 3. converts anything thrown into the shared error envelope.
 *
 * Because authentication is part of the wrapper rather than a call inside each
 * handler, "this endpoint forgot to check auth" is not a mistake that can be
 * made here: an unwrapped export would not compile against the helper's type.
 */
export type AuthenticatedHandler<TContext> = (args: {
  request: NextRequest
  context: TContext
  user: AuthenticatedUser
  requestId: string
}) => Promise<Response>

export function withAuth<TContext>(
  handler: AuthenticatedHandler<TContext>,
): (request: NextRequest, context: TContext) => Promise<Response> {
  return async (request: NextRequest, context: TContext) => {
    const requestId = request.headers.get('x-request-id') ?? randomUUID()

    try {
      const user = await authenticateRequest(request)
      return await handler({ request, context, user, requestId })
    } catch (error) {
      return failure(toAppError(error, requestId, request), requestId)
    }
  }
}

/**
 * Map an unknown thrown value onto the error taxonomy.
 *
 * Anything that is not already an `AppError` or a `ZodError` is a bug or an
 * infrastructure failure. Those are logged in full and reported as an opaque
 * 500: stack traces, SQL and connection strings must never reach a client.
 */
function toAppError(error: unknown, requestId: string, request: NextRequest): AppError {
  if (isAppError(error)) {
    return error
  }

  if (error instanceof ZodError) {
    return AppError.validation('The request body failed validation.', zodIssues(error))
  }

  console.error(
    JSON.stringify({
      level: 'error',
      requestId,
      method: request.method,
      path: new URL(request.url).pathname,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }),
  )

  return AppError.internal()
}

export function zodIssues(error: ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : '(root)',
    message: issue.message,
  }))
}

/** Parse a JSON body, turning a malformed one into a 400 rather than a 500. */
export async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw AppError.validation('The request body must be valid JSON.')
  }
}
