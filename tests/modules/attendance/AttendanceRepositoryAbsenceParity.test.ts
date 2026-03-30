import { beforeEach, describe, expect, it } from 'vitest'

import { prismaMock } from '../../setup'
import { AttendanceRepository } from '@/modules/attendance/repositories/AttendanceRepository'

describe('AttendanceRepository absence parity', () => {
  let repository: AttendanceRepository

  beforeEach(() => {
    repository = new AttendanceRepository()
  })

  it('queries user absence stats using both ALPHA and ABSENT statuses', async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([{ id: 'user-1' }])
    prismaMock.attendance.groupBy.mockResolvedValueOnce([])

    await repository.getUserAbsenceStats(new Date('2026-03-01'), new Date('2026-03-31'))

    expect(prismaMock.attendance.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['ALPHA', 'ABSENT'] },
        }),
      })
    )
  })

  it('queries top absentees using both ALPHA and ABSENT statuses', async () => {
    prismaMock.user.findMany
      .mockResolvedValueOnce([{ id: 'user-1' }])
      .mockResolvedValueOnce([{ id: 'user-1', name: 'User One', image: null, sites: { name: 'HQ' }, departments: { name: 'Ops' } }])
    prismaMock.attendance.groupBy.mockResolvedValueOnce([{ userId: 'user-1', _count: { _all: 2 } }])

    await repository.getTopAbsentees(new Date('2026-03-01'), new Date('2026-03-31'), 5)

    expect(prismaMock.attendance.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['ALPHA', 'ABSENT'] },
        }),
      })
    )
  })
})
