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

  it('aligns Jenkins migration wait budget with the Job deadline and captures richer diagnostics on failure', () => {
    const jenkinsfile = readFileSync(resolve(process.cwd(), 'Jenkinsfile'), 'utf8')

    expect(jenkinsfile).toContain('MAX_WAIT_SECONDS=1800')
    expect(jenkinsfile).toContain('POLL_INTERVAL=10')
    expect(jenkinsfile).toContain('MAX_ATTEMPTS=$((MAX_WAIT_SECONDS / POLL_INTERVAL))')
    expect(jenkinsfile).not.toContain('for i in $(seq 1 60)')
    expect(jenkinsfile).not.toContain('⚠️ Job timeout (10 menit).')
    expect(jenkinsfile).toContain('kubectl describe job netmanager-migration-job --namespace=${NAMESPACE} || true')
    expect(jenkinsfile).toContain('-l job-name=netmanager-migration-job')
    expect(jenkinsfile).toContain('kubectl describe pod "\\$POD_NAME" --namespace=${NAMESPACE} || true')
    expect(jenkinsfile).toContain('kubectl logs "\\$POD_NAME" --namespace=${NAMESPACE} --tail=100 || true')
  })
})
