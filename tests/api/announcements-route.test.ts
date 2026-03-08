import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prismaMock } from '../setup'

const mockFns = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getSocketServer: vi.fn(),
  logActivity: vi.fn(),
  sendExpoPushNotifications: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: mockFns.requireAuth,
}))

vi.mock('@/lib/websocket/server', () => ({
  getSocketServer: mockFns.getSocketServer,
}))

vi.mock('@/lib/logger', () => ({
  logger: { logActivity: mockFns.logActivity },
}))

vi.mock('@/lib/expo', () => ({
  sendExpoPushNotifications: mockFns.sendExpoPushNotifications,
}))

import { POST } from '@/app/api/announcements/route'

describe('announcements route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFns.requireAuth.mockResolvedValue({
      user: { id: 'admin-1' },
    })
    mockFns.getSocketServer.mockReturnValue({ emit: vi.fn() })
    prismaMock.announcement.create.mockResolvedValue({
      id: 'ann-1',
      title: 'Pengumuman',
      content: 'Isi',
      target: 'ADMIN',
      isPinned: false,
      createdAt: new Date('2026-03-08T10:00:00.000Z'),
    })
    prismaMock.leaveRequest.findMany.mockResolvedValue([])
  })

  it('targets admin announcements to admin and super admin roles with the correct prisma relation', async () => {
    prismaMock.user.findMany
      .mockResolvedValueOnce([
        { id: 'admin-1', pushToken: 'token-1' },
        { id: 'super-1', pushToken: 'token-2' },
      ])
      .mockResolvedValueOnce([
        { id: 'admin-1' },
        { id: 'super-1' },
      ])

    const response = await POST(new NextRequest('http://localhost/api/announcements', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Pengumuman',
        content: 'Isi',
        target: 'ADMIN',
        isActive: true,
      }),
      headers: { 'content-type': 'application/json' },
    }))

    expect(response.status).toBe(200)
    expect(prismaMock.user.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({
        role: { name: { in: ['ADMIN', 'SUPER_ADMIN'] } },
      }),
    }))
    expect(prismaMock.notifications.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ userId: 'admin-1', sourceType: 'ANNOUNCEMENT' }),
        expect.objectContaining({ userId: 'super-1', sourceType: 'ANNOUNCEMENT' }),
      ],
    })
  })
})
