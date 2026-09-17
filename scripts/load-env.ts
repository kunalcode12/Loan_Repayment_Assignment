import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { config } from 'dotenv'

/**
 * Load the same environment files that `next dev` loads, for scripts and tests
 * that run outside the Next.js runtime.
 *
 * Order matters: `dotenv` never overwrites a variable that is already set, so
 * loading `.env.local` first gives it priority over `.env`, and anything already
 * exported in the real environment (CI secrets, for instance) wins over both.
 */
export function loadEnv(): void {
  for (const file of ['.env.local', '.env']) {
    const path = join(process.cwd(), file)
    if (existsSync(path)) {
      config({ path, quiet: true })
    }
  }
}
