import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFns = vi.hoisted(() => ({
  headers: vi.fn(),
  runAutoCheckout: vi.fn(),
  acquireCronLock: vi.fn(),
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

vi.mock('@/modules/attendance/services/AutoCheckoutService', () => ({
  AutoCheckoutService: {
    runAutoCheckout: mockFns.runAutoCheckout,
  },
}))

import { POST } from '@/app/api/cron/auto-checkout/route'

describe('auto-checkout cron route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFns.headers.mockResolvedValue(new Headers({ authorization: 'Bearer cron-secret' }))
  })

  it('returns a skip response when the auto-checkout lock is already held', async () => {
    mockFns.acquireCronLock.mockResolvedValue(false)

    const response = await POST(new Request('http://localhost/api/cron/auto-checkout', {
      method: 'POST',
    }))
    const json = await response.json()

    expect(json.success).toBe(true)
    expect(json.data.skipped).toBe(true)
    expect(json.data.reason).toBe('Lock already held')
    expect(mockFns.acquireCronLock).toHaveBeenCalledWith('autoCheckout', 82800)
    expect(mockFns.runAutoCheckout).not.toHaveBeenCalled()
  })
})
