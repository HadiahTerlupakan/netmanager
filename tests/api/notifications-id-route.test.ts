import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockFns = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getReadableNotificationForUser: vi.fn(),
  markAsRead: vi.fn(),
  getUserPermissions: vi.fn(),
  isSuperAdmin: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: mockFns.requireAuth,
}))

vi.mock('@/modules/notification', () => ({
  getReadableNotificationForUser: mockFns.getReadableNotificationForUser,
  markAsRead: mockFns.markAsRead,
}))

vi.mock('@/lib/auth', () => ({
  getUserPermissions: mockFns.getUserPermissions,
  isSuperAdmin: mockFns.isSuperAdmin,
}))

import { PATCH } from '@/app/api/notifications/[id]/route'

describe('web notifications id route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFns.requireAuth.mockResolvedValue({
      user: {
        id: 'user-1',
        departmentId: 'dept-1',
        siteId: 'site-1',
        role: 'USER',
      },
    })
    mockFns.getUserPermissions.mockResolvedValue([])
    mockFns.isSuperAdmin.mockReturnValue(false)
  })

  it('marks a readable notification as read', async () => {
    mockFns.getReadableNotificationForUser.mockResolvedValueOnce({ id: 'notif-1' })

    const response = await PATCH(new NextRequest('http://localhost/api/notifications/notif-1', {
      method: 'PATCH',
    }), { params: Promise.resolve({ id: 'notif-1' }) })
    const json = await response.json()

    expect(mockFns.getReadableNotificationForUser).toHaveBeenCalledWith('notif-1', 'user-1', {
      departmentId: 'dept-1',
      siteId: undefined,
    })
    expect(mockFns.markAsRead).toHaveBeenCalledWith('notif-1')
    expect(json.success).toBe(true)
  })

  it('returns 404 when the notification is hidden from the user', async () => {
    mockFns.getReadableNotificationForUser.mockResolvedValueOnce(null)

    const response = await PATCH(new NextRequest('http://localhost/api/notifications/notif-2', {
      method: 'PATCH',
    }), { params: Promise.resolve({ id: 'notif-2' }) })

    expect(response.status).toBe(404)
    expect(mockFns.markAsRead).not.toHaveBeenCalled()
  })
})
