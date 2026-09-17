'use client'

import { currentIdToken } from '@/auth/firebase-client'
import type {
  AllocationDto,
  InstallmentDto,
  LoanDto,
  PaymentDto,
  PositionDto,
} from '@/api/serializers'
import type { ErrorCode, FieldIssue } from '@/lib/errors'

/**
 * Browser-side client for the three endpoints.
 *
 * Every call attaches a freshly-minted Firebase ID token. The token is fetched
 * per request rather than held in a variable because the SDK rotates it roughly
 * hourly, and a stale token would produce a confusing 401 mid-session.
 */

export class ApiError extends Error {
  readonly code: ErrorCode | 'NETWORK_ERROR'
  readonly status: number
  readonly issues: FieldIssue[]

  constructor(params: {
    code: ErrorCode | 'NETWORK_ERROR'
    message: string
    status: number
    issues?: FieldIssue[]
  }) {
    super(params.message)
    this.name = 'ApiError'
    this.code = params.code
    this.status = params.status
    this.issues = params.issues ?? []
  }
}

export interface LoanDetailResponse {
  loan: LoanDto
  schedule: InstallmentDto[]
  position: PositionDto
  payments: PaymentDto[]
}

export interface LoanListResponse {
  loans: { loan: LoanDto; position: PositionDto }[]
}

export interface RecordPaymentResponse extends LoanDetailResponse {
  duplicate: boolean
  payment: PaymentDto
  allocations: AllocationDto[]
}

export interface CreateLoanResponse {
  loan: LoanDto
  schedule: InstallmentDto[]
  position: PositionDto
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await currentIdToken()

  if (!token) {
    throw new ApiError({
      code: 'UNAUTHENTICATED',
      message: 'Your session has ended. Sign in again to continue.',
      status: 401,
    })
  }

  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        ...init.headers,
      },
      cache: 'no-store',
    })
  } catch {
    throw new ApiError({
      code: 'NETWORK_ERROR',
      message: 'Could not reach the server. Check your connection and try again.',
      status: 0,
    })
  }

  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const error = (body as { error?: { code?: ErrorCode; message?: string; issues?: FieldIssue[] } })
      ?.error
    throw new ApiError({
      code: error?.code ?? 'INTERNAL_ERROR',
      message: error?.message ?? `Request failed with status ${response.status}.`,
      status: response.status,
      issues: error?.issues,
    })
  }

  return (body as { data: T }).data
}

export function listLoans(): Promise<LoanListResponse> {
  return request<LoanListResponse>('/api/loans')
}

export function getLoan(loanId: string): Promise<LoanDetailResponse> {
  return request<LoanDetailResponse>(`/api/loans/${loanId}`)
}

export function createLoan(input: {
  principal: number
  annualInterestRate: number
  tenureMonths: number
  disbursementDate: string
}): Promise<CreateLoanResponse> {
  return request<CreateLoanResponse>('/api/loans', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function recordPayment(input: {
  loanId: string
  amount: number
  paymentDate: string
  idempotencyKey: string
}): Promise<RecordPaymentResponse> {
  return request<RecordPaymentResponse>('/api/payments', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
