import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFns = vi.hoisted(() => ({
  headers: vi.fn(),
  acquireCronLock: vi.fn(),
  processDailyAbsence: vi.fn(),
  tenantFindMany: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: mockFns.headers,
}))

vi.mock('@/lib/env', () => ({
  getEnv: () => ({ CRON_SECRET: 'cron-secret' }),
}))

vi.mock('@/lib/cron-lock', () => ({
  acquireCronLock: mockFns.acquireCronLock,
}))

vi.mock('@/modules/attendance/services/AbsenceService', () => ({
  AbsenceService: class MockAbsenceService {
    processDailyAbsence = mockFns.processDailyAbsence
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenant: {
      findMany: mockFns.tenantFindMany,
    },
  },
}))

import { POST } from '@/app/api/cron/process-absence/route'

describe('process-absence cron route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFns.headers.mockResolvedValue(new Headers({ authorization: 'Bearer cron-secret' }))
  })

  it('returns a skip response when the process-absence lock is already held', async () => {
    mockFns.acquireCronLock.mockResolvedValue(false)

    const response = await POST(new Request('http://localhost/api/cron/process-absence', {
      method: 'POST',
      body: JSON.stringify({ date: '2026-03-29' }),
      headers: { 'content-type': 'application/json' },
    }))
    const json = await response.json()

    expect(json.success).toBe(true)
    expect(json.skipped).toBe(true)
    expect(json.reason).toBe('Lock already held')
    expect(mockFns.acquireCronLock).toHaveBeenCalledWith('processAbsence:2026-03-29', 60 * 60)
    expect(mockFns.tenantFindMany).not.toHaveBeenCalled()
    expect(mockFns.processDailyAbsence).not.toHaveBeenCalled()
  })
})
