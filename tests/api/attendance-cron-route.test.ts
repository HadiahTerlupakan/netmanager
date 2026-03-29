import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFns = vi.hoisted(() => ({
  processDailyAbsence: vi.fn(),
  tenantFindMany: vi.fn(),
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

import { GET } from '@/app/api/cron/attendance/route'

describe('legacy attendance cron route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
  })

  it('rejects requests without a valid cron secret', async () => {
    const response = await GET(new Request('http://localhost/api/cron/attendance'))
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
  })

  it('delegates H+1 absence generation to AbsenceService and reports ALPHA totals', async () => {
    mockFns.tenantFindMany.mockResolvedValue([{ id: 'tenant-1' }, { id: 'tenant-2' }])
    mockFns.processDailyAbsence
      .mockResolvedValueOnce({ processed: 12, alpha: 2 })
      .mockResolvedValueOnce({ processed: 8, alpha: 3 })

    const response = await GET(new Request('http://localhost/api/cron/attendance', {
      headers: { authorization: 'Bearer cron-secret' },
    }))
    const json = await response.json()

    expect(mockFns.tenantFindMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true },
    })
    expect(mockFns.processDailyAbsence).toHaveBeenNthCalledWith(1, expect.any(Date), 'tenant-1')
    expect(mockFns.processDailyAbsence).toHaveBeenNthCalledWith(2, expect.any(Date), 'tenant-2')
    expect(json.totalGenerated).toBe(5)
    expect(json.log).toEqual([
      'Processed Tenant tenant-1: generated 2 ALPHA records',
      'Processed Tenant tenant-2: generated 3 ALPHA records',
    ])
    expect(json.success).toBe(true)
  })
})
