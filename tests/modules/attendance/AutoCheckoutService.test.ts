import { beforeEach, describe, expect, it, vi } from 'vitest'

import { prismaMock } from '../../setup'
import { AutoCheckoutService } from '@/modules/attendance/services/AutoCheckoutService'
import { ATTENDANCE_CONSTANTS } from '@/modules/attendance/utils/constants'

vi.mock('@/lib/utils/get-timezone', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils/get-timezone')>()
  return {
    ...actual,
    getTimezone: vi.fn().mockResolvedValue('Asia/Jakarta'),
  }
})

describe('AutoCheckoutService semantics', () => {
  beforeEach(() => {
    prismaMock.attendance.findMany.mockResolvedValue([
      {
        id: 'att-1',
        checkIn: new Date('2026-03-27T06:37:00.000Z'),
        checkOut: null,
        status: 'LATE',
        notes: null,
        user: {
          name: 'Ubaidilah',
          workingHourMode: 'FIXED',
          shift: null,
        },
      },
    ] as never)
    prismaMock.attendance.update.mockResolvedValue({ id: 'att-1' } as never)
  })

  it('writes the canonical auto-checkout note instead of the legacy Mangkir note', async () => {
    await AutoCheckoutService.runAutoCheckout()

    expect(prismaMock.attendance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          notes: ATTENDANCE_CONSTANTS.AUTO_CHECKOUT_NOTE,
          status: 'NO_CHECKOUT',
        }),
      })
    )
  })
})
