import { beforeEach, describe, expect, it } from 'vitest'

import { cache } from '@/lib/cache'
import { HolidayRepository } from '@/modules/attendance/repositories/HolidayRepository'
import { prismaMock } from '../../setup'

describe('HolidayRepository', () => {
  beforeEach(() => {
    cache.clear()
    prismaMock.holiday.findFirst.mockResolvedValue(null)
  })

  it('does not reuse previous local-day holiday cache after midnight Asia/Jakarta', async () => {
    const repo = new HolidayRepository()

    prismaMock.holiday.findFirst
      .mockResolvedValueOnce({
        id: 'holiday-yesterday',
        date: new Date('2026-03-18T00:00:00.000Z'),
        description: 'Nyepi',
        tenantId: 'tenant-1',
      })
      .mockResolvedValueOnce(null)

    const lateNightYesterday = await repo.isHoliday(new Date('2026-03-18T16:30:00.000Z'), 'tenant-1')
    const earlyMorningToday = await repo.isHoliday(new Date('2026-03-18T18:30:00.000Z'), 'tenant-1')

    expect(lateNightYesterday.isHoliday).toBe(true)
    expect(earlyMorningToday.isHoliday).toBe(false)
    expect(prismaMock.holiday.findFirst).toHaveBeenCalledTimes(2)
  })
})
