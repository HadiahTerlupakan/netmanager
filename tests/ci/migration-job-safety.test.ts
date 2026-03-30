import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('migration job safety', () => {
  it('classifies optional backfill steps explicitly and supports strict mode', () => {
    const migrationJob = readFileSync(resolve(process.cwd(), 'k8s', 'migration-job.yaml'), 'utf8')

    expect(migrationJob).toContain('run_optional_step()')
    expect(migrationJob).toContain('FAIL_ON_OPTIONAL_MIGRATION_ERRORS')
    expect(migrationJob).toContain('OPTIONAL_FAILURES=$((OPTIONAL_FAILURES + 1))')
    expect(migrationJob).toContain('Optional migration steps completed with')
  })
})
