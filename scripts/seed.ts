import { loadEnv } from './load-env'

loadEnv()

import { closePool, query } from '@/db/client'
import { runMigrations } from '@/db/migrate'
import { createLoan } from '@/services/loan.service'
import { recordPayment } from '@/services/payment.service'
import { addDays, addMonths, today } from '@/lib/date'
import { percentToBasisPoints, rupeesToPaise } from '@/lib/money'

/**
 * `npm run db:seed`
 *
 * Creates three loans that between them exercise every case in the brief, so
 * the UI has something real to show immediately after setup:
 *
 * 1. a healthy loan, paid exactly on time;
 * 2. a stressed loan with an underpayment and an instalment eleven days late;
 * 3. a fresh loan with no payments at all.
 *
 * The loan in (1) is the brief's reference loan: Rs 2,00,000 at 18% p.a. over
 * 24 months.
 *
 * Seeding is additive — it never truncates — so running it twice simply adds
 * more loans.
 */

const REFERENCE_LOAN = {
  principal: 200_000,
  annualInterestRate: 18,
  tenureMonths: 24,
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.')
  }

  // Seeding an empty database should just work, so make sure the schema exists.
  await runMigrations()

  const now = today()
  // Back-date disbursement so that instalments have genuinely fallen due.
  const disbursedFourMonthsAgo = addMonths(now, -4)
  const disbursedThreeMonthsAgo = addMonths(now, -3)

  console.log('Seeding demo loans...\n')

  // 1. On-time repayment of the brief's reference loan.
  const healthy = await createLoan({
    principal: rupeesToPaise(REFERENCE_LOAN.principal),
    annualRateBps: percentToBasisPoints(REFERENCE_LOAN.annualInterestRate),
    tenureMonths: REFERENCE_LOAN.tenureMonths,
    disbursementDate: disbursedFourMonthsAgo,
  })

  for (const installment of healthy.installments.slice(0, 3)) {
    await recordPayment({
      loanId: healthy.loan.id,
      amount: installment.totalDue,
      paymentDate: installment.dueDate,
      idempotencyKey: `seed-healthy-${healthy.loan.id}-${installment.installmentNumber}`,
      recordedBy: 'seed-script',
    })
  }
  report('On time', healthy.loan.reference, healthy.loan.id)

  // 2. An underpayment, then a payment eleven days after the due date.
  const stressed = await createLoan({
    principal: rupeesToPaise(350_000),
    annualRateBps: percentToBasisPoints(16.5),
    tenureMonths: 18,
    disbursementDate: disbursedThreeMonthsAgo,
  })

  const [first, second] = stressed.installments
  if (first && second) {
    await recordPayment({
      loanId: stressed.loan.id,
      amount: rupeesToPaise(5_000), // far short of the instalment
      paymentDate: first.dueDate,
      idempotencyKey: `seed-stressed-${stressed.loan.id}-underpaid`,
      recordedBy: 'seed-script',
    })

    await recordPayment({
      loanId: stressed.loan.id,
      amount: rupeesToPaise(25_000),
      paymentDate: addDays(second.dueDate, 11), // eleven days late
      idempotencyKey: `seed-stressed-${stressed.loan.id}-late`,
      recordedBy: 'seed-script',
    })
  }
  report('Arrears', stressed.loan.reference, stressed.loan.id)

  // 3. Brand new, nothing paid yet.
  const fresh = await createLoan({
    principal: rupeesToPaise(75_000),
    annualRateBps: percentToBasisPoints(22),
    tenureMonths: 12,
    disbursementDate: now,
  })
  report('Untouched', fresh.loan.reference, fresh.loan.id)

  const [{ count } = { count: '0' }] = await query<{ count: string }>(
    'SELECT count(*)::text AS count FROM loans',
  )
  console.log(`\nDone. The database now holds ${count} loan(s).`)
  console.log('Start the app with `npm run dev` and open http://localhost:3000')
}

function report(label: string, reference: string, id: string): void {
  console.log(`  ${label.padEnd(10)} ${reference}  ${id}`)
}

main()
  .catch((error: unknown) => {
    console.error('\nSeeding failed:')
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => closePool())
