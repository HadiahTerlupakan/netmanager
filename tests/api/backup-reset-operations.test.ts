import { describe, expect, it } from 'vitest'
import { shouldRunSeedAfterReset, type ResetResult } from '@/app/api/settings/backup/reset/reset-operations'

describe('shouldRunSeedAfterReset', () => {
  it('returns true when all reset results are successful', () => {
    const results: ResetResult[] = [
      { database: 'netmanager', status: 'success', message: 'ok' },
      { database: 'radius', status: 'success', message: 'ok' },
      { database: 'billing', status: 'success', message: 'ok' },
      { database: 'mitra', status: 'success', message: 'ok' },
    ]

    expect(shouldRunSeedAfterReset(results)).toBe(true)
  })

  it('returns false when any database reset is skipped', () => {
    const results: ResetResult[] = [
      { database: 'netmanager', status: 'success', message: 'ok' },
      { database: 'radius', status: 'skipped', message: 'missing env' },
    ]

    expect(shouldRunSeedAfterReset(results)).toBe(false)
  })

  it('returns false when any database reset has error', () => {
    const results: ResetResult[] = [
      { database: 'netmanager', status: 'success', message: 'ok' },
      { database: 'radius', status: 'error', message: 'failed' },
    ]

    expect(shouldRunSeedAfterReset(results)).toBe(false)
  })
})
