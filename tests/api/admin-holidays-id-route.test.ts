import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  hasPermission: vi.fn(),
  logActivity: vi.fn(),
  holidayDelete: vi.fn(),
}))

vi.mock('next-auth', () => ({
  getServerSession: mockFns.getServerSession,
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
  getUserPermissions: mockFns.getUserPermissions,
}))

vi.mock('@/lib/rbac', () => ({
  hasPermission: mockFns.hasPermission,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    logActivity: mockFns.logActivity,
  },
}))

vi.mock('@/modules/attendance/repositories/HolidayRepository', () => ({
  HolidayRepository: class {
    delete = mockFns.holidayDelete
  },
}))

import { DELETE } from '@/app/api/admin/holidays/[id]/route'

describe('admin holiday id route', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockFns.getServerSession.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        permissions: ['holiday:delete'],
      },
    })
    mockFns.getUserPermissions.mockResolvedValue(['holiday:delete'])
    mockFns.hasPermission.mockResolvedValue(true)
  })

  it('returns success when the holiday was already deleted by a concurrent request', async () => {
    mockFns.holidayDelete.mockRejectedValue(
      Object.assign(
        new Error(
          'Invalid `prisma.holiday.delete()` invocation:\nNo record was found for a delete.'
        ),
        {
          code: 'P2025',
          meta: { modelName: 'Holiday', operation: 'a delete' },
        }
      )
    )

    const response = await DELETE(
      new NextRequest('http://localhost/api/admin/holidays/holiday-1', {
        method: 'DELETE',
      }),
      {
        params: Promise.resolve({ id: 'holiday-1' }),
      }
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      success: true,
      data: null,
      message: 'Hari libur sudah tidak ada',
    })
    expect(mockFns.logActivity).not.toHaveBeenCalled()
  })
})
