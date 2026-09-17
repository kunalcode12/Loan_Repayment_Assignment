import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { config } from 'dotenv'


for (const file of ['.env.local', '.env']) {
  const path = join(process.cwd(), file)
  if (existsSync(path)) {
    config({ path, quiet: true })
  }
}

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
}
