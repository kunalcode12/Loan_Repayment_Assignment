/**
 * The error taxonomy shared by every route handler.
 *
 * Handlers throw an `AppError`; a single wrapper (`src/api/handler.ts`) turns it
 * into the one error envelope used by all three endpoints. Anything that is not
 * an `AppError` is treated as a bug: it is logged with its stack and reported as
 * an opaque `INTERNAL_ERROR`, so internal details never reach a client.
 */

export const ERROR_CODES = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const

export type ErrorCode = keyof typeof ERROR_CODES

export interface FieldIssue {
  field: string
  message: string
}

export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly issues?: FieldIssue[]

  constructor(code: ErrorCode, message: string, issues?: FieldIssue[]) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = ERROR_CODES[code]
    this.issues = issues
  }

  static validation(message: string, issues?: FieldIssue[]): AppError {
    return new AppError('VALIDATION_ERROR', message, issues)
  }

  static unauthenticated(message = 'Authentication is required to access this resource.'): AppError {
    return new AppError('UNAUTHENTICATED', message)
  }

  static notFound(message: string): AppError {
    return new AppError('NOT_FOUND', message)
  }

  static conflict(message: string): AppError {
    return new AppError('CONFLICT', message)
  }

  static unprocessable(message: string, issues?: FieldIssue[]): AppError {
    return new AppError('UNPROCESSABLE_ENTITY', message, issues)
  }

  static internal(message = 'An unexpected error occurred.'): AppError {
    return new AppError('INTERNAL_ERROR', message)
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}
