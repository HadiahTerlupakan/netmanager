import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import {
  shouldStartInternalCron,
  startInternalCronIfEnabled,
} from '@/lib/runtime/should-start-internal-cron'

describe('shouldStartInternalCron', () => {
  it('returns false when ENABLE_INTERNAL_CRON is false', () => {
    expect(shouldStartInternalCron({ ENABLE_INTERNAL_CRON: 'false' })).toBe(false)
  })

  it('returns true when ENABLE_INTERNAL_CRON is true', () => {
    expect(shouldStartInternalCron({ ENABLE_INTERNAL_CRON: 'true' })).toBe(true)
  })

  it('defaults to true when the flag is unset', () => {
    expect(shouldStartInternalCron({})).toBe(true)
  })
})

describe('startInternalCronIfEnabled', () => {
  it('skips cron startup when the helper returns false', () => {
    const startAll = vi.fn()
    const logger = { log: vi.fn() }

    const started = startInternalCronIfEnabled({
      env: { ENABLE_INTERNAL_CRON: 'false' },
      startAll,
      logger,
    })

    expect(started).toBe(false)
    expect(startAll).not.toHaveBeenCalled()
    expect(logger.log).toHaveBeenCalledWith('[Cron] Internal cron disabled for this runtime')
  })

  it('starts cron when the helper returns true', () => {
    const startAll = vi.fn()
    const logger = { log: vi.fn() }

    const started = startInternalCronIfEnabled({
      env: { ENABLE_INTERNAL_CRON: 'true' },
      startAll,
      logger,
    })

    expect(started).toBe(true)
    expect(startAll).toHaveBeenCalledTimes(1)
    expect(logger.log).not.toHaveBeenCalled()
  })
})

describe('runtime entrypoint wiring', () => {
  it.each([
    'server.ts',
    'server-api.ts',
    'worker.ts',
  ])('uses the internal cron startup helper in %s', (relativePath) => {
    const file = readFileSync(resolve(process.cwd(), relativePath), 'utf8')

    expect(file).toContain('startInternalCronIfEnabled')
  })
})
