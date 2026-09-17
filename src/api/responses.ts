import { NextResponse } from 'next/server'

import { AppError, type ErrorCode, type FieldIssue } from '@/lib/errors'

/**
 * The response envelope shared by all three endpoints.
 *
 * Success:  `{ "data": { ... }, "requestId": "..." }`
 * Failure:  `{ "error": { "code", "message", "issues"? }, "requestId": "..." }`
 *
 * `data` and `error` are mutually exclusive, so a client can branch on the HTTP
 * status or on the presence of `error` and get the same answer. `code` is a
 * stable machine-readable string; `message` is for humans and may change.
 */

export interface SuccessBody<T> {
  data: T
  requestId: string
}

export interface ErrorBody {
  error: {
    code: ErrorCode
    message: string
    issues?: FieldIssue[]
  }
  requestId: string
}

export function success<T>(data: T, init: { status?: number; requestId: string }): NextResponse {
  return NextResponse.json<SuccessBody<T>>(
    { data, requestId: init.requestId },
    { status: init.status ?? 200, headers: { 'x-request-id': init.requestId } },
  )
}

export function failure(error: AppError, requestId: string): NextResponse {
  return NextResponse.json<ErrorBody>(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.issues && error.issues.length > 0 ? { issues: error.issues } : {}),
      },
      requestId,
    },
    {
      status: error.status,
      headers: {
        'x-request-id': requestId,
        // Tells a browser client which scheme to use, per RFC 6750.
        ...(error.status === 401 ? { 'www-authenticate': 'Bearer' } : {}),
      },
    },
  )
}
