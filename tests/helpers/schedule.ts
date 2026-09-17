import { ZERO, type Paise } from '@/lib/money'
import type { AllocatableInstallment, AllocationLine, GeneratedSchedule } from '@/domain/types'

/**
 * Turn a freshly generated schedule into the shape the allocator consumes,
 * with nothing paid yet.
 */
export function allocatableFrom(schedule: GeneratedSchedule): AllocatableInstallment[] {
  return schedule.installments.map((installment) => ({
    id: `installment-${installment.installmentNumber}`,
    installmentNumber: installment.installmentNumber,
    dueDate: installment.dueDate,
    principalComponent: installment.principalComponent,
    interestComponent: installment.interestComponent,
    principalPaid: ZERO,
    interestPaid: ZERO,
  }))
}

/**
 * Apply allocation lines to instalments, as the repository layer would.
 *
 * Lets a test chain several payments against the same schedule without a
 * database.
 */
export function applyLines(
  installments: AllocatableInstallment[],
  lines: AllocationLine[],
): AllocatableInstallment[] {
  return installments.map((installment) => {
    const line = lines.find((candidate) => candidate.installmentId === installment.id)
    if (!line) return installment
    return {
      ...installment,
      interestPaid: (installment.interestPaid + line.interest) as Paise,
      principalPaid: (installment.principalPaid + line.principal) as Paise,
    }
  })
}
