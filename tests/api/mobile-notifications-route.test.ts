import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockFns = vi.hoisted(() => ({
  getMobileAuthPayload: vi.fn(),
  getNotificationsForUser: vi.fn(),
  getUnreadCount: vi.fn(),
  getReadableNotificationForUser: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
}))

vi.mock('@/lib/mobile-api-auth', () => ({
  getMobileAuthPayload: mockFns.getMobileAuthPayload,
}))

vi.mock('@/modules/notification', () => ({
  getNotificationsForUser: mockFns.getNotificationsForUser,
  getUnreadCount: mockFns.getUnreadCount,
  getReadableNotificationForUser: mockFns.getReadableNotificationForUser,
  markAsRead: mockFns.markAsRead,
  markAllAsRead: mockFns.markAllAsRead,
}))

import { GET, POST } from '@/app/api/mobile/notifications/route'

describe('mobile notifications route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFns.getMobileAuthPayload.mockResolvedValue({ userId: 'user-1', permissions: [] })
  })

  it('returns nextCursor for paginated notification responses', async () => {
    mockFns.getNotificationsForUser.mockResolvedValueOnce({
      notifications: [
        {
          id: 'notif-1',
          type: 'SYSTEM',
          title: 'One',
          message: 'First',
          link: '/foo',
          isRead: false,
          sourceType: 'WORK_ORDER',
          sourceId: 'wo-1',
          createdAt: new Date('2026-03-08T10:00:00.000Z'),
        },
        {
          id: 'notif-2',
          type: 'SYSTEM',
          title: 'Two',
          message: 'Second',
          link: '/bar',
          isRead: true,
          sourceType: 'LEAVE',
          sourceId: 'leave-1',
          createdAt: new Date('2026-03-08T09:00:00.000Z'),
        },
      ],
      total: 3,
    })
    mockFns.getUnreadCount.mockResolvedValueOnce(4)

    const response = await GET(new NextRequest('http://localhost/api/mobile/notifications?limit=2'))
    const json = await response.json()

    expect(mockFns.getNotificationsForUser).toHaveBeenCalledWith('user-1', {
      limit: 2,
      offset: 0,
    })
    expect(json.data.unreadCount).toBe(4)
    expect(json.data.nextCursor).toBe('2')
    expect(json.data.notifications).toHaveLength(2)
    expect(json.data.notifications[0].link).toBe('/(app)/work-order-detail/wo-1')
  })

  it('maps attendance notifications to the mobile absensi screen', async () => {
    mockFns.getNotificationsForUser.mockResolvedValueOnce({
      notifications: [
        {
          id: 'notif-att-1',
          type: 'ALERT',
          title: 'Absensi Belum Lengkap',
          message: 'Segera lengkapi absensi Anda',
          link: '/attendance',
          isRead: false,
          sourceType: 'ATTENDANCE',
          sourceId: 'att-1',
          createdAt: new Date('2026-03-08T08:00:00.000Z'),
        },
      ],
      total: 1,
    })
    mockFns.getUnreadCount.mockResolvedValueOnce(1)

    const response = await GET(new NextRequest('http://localhost/api/mobile/notifications?limit=1'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.notifications[0].link).toBe('/(app)/absensi')
  })

  it('maps canvasing notifications to the mobile marketing canvasing detail screen', async () => {
    mockFns.getNotificationsForUser.mockResolvedValueOnce({
      notifications: [
        {
          id: 'notif-canv-1',
          type: 'ANNOUNCEMENT',
          title: 'Canvasing Disetujui',
          message: 'WO baru sudah dibuat',
          link: '/admin/marketing/canvasing/canv-1',
          isRead: false,
          sourceType: 'CANVASING',
          sourceId: 'canv-1',
          createdAt: new Date('2026-03-08T08:30:00.000Z'),
        },
      ],
      total: 1,
    })
    mockFns.getUnreadCount.mockResolvedValueOnce(1)

    const response = await GET(new NextRequest('http://localhost/api/mobile/notifications?limit=1'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.notifications[0].link).toBe('/(app)/marketing/canvasing/canv-1')
  })

  it('maps point claim notifications to the related mobile canvasing detail screen', async () => {
    mockFns.getNotificationsForUser.mockResolvedValueOnce({
      notifications: [
        {
          id: 'notif-claim-1',
          type: 'ANNOUNCEMENT',
          title: 'Claim Poin Disetujui',
          message: 'Claim Anda disetujui',
          link: '/marketing/canvasing/canv-99',
          isRead: false,
          sourceType: 'POINT_CLAIM',
          sourceId: 'claim-1',
          createdAt: new Date('2026-03-08T09:00:00.000Z'),
        },
      ],
      total: 1,
    })
    mockFns.getUnreadCount.mockResolvedValueOnce(1)

    const response = await GET(new NextRequest('http://localhost/api/mobile/notifications?limit=1'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.notifications[0].link).toBe('/(app)/marketing/canvasing/canv-99')
  })

  it('rejects markRead when the notification is not readable by the user', async () => {
    mockFns.getReadableNotificationForUser.mockResolvedValueOnce(null)

    const response = await POST(new NextRequest('http://localhost/api/mobile/notifications', {
      method: 'POST',
      body: JSON.stringify({ action: 'markRead', notificationId: 'notif-404' }),
      headers: { 'content-type': 'application/json' },
    }))
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error).toBe('Notifikasi tidak ditemukan')
    expect(mockFns.markAsRead).not.toHaveBeenCalled()
  })

  it('passes site-only restriction to the single notification guard', async () => {
    mockFns.getMobileAuthPayload.mockResolvedValueOnce({
      userId: 'user-1',
      permissions: ['site_only'],
      siteId: 'site-9',
    })
    mockFns.getReadableNotificationForUser.mockResolvedValueOnce({ id: 'notif-9' })

    const response = await POST(new NextRequest('http://localhost/api/mobile/notifications', {
      method: 'POST',
      body: JSON.stringify({ action: 'markRead', notificationId: 'notif-9' }),
      headers: { 'content-type': 'application/json' },
    }))

    expect(response.status).toBe(200)
    expect(mockFns.getReadableNotificationForUser).toHaveBeenCalledWith('notif-9', 'user-1', {
      siteId: 'site-9',
    })
    expect(mockFns.markAsRead).toHaveBeenCalledWith('notif-9')
  })
})
