import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockFns = vi.hoisted(() => ({
  requireCustomerAuth: vi.fn(),
}))

vi.mock('@/lib/customer-auth', () => ({
  requireCustomerAuth: mockFns.requireCustomerAuth,
}))

import { prismaMock } from '../setup'
import { GET } from '@/app/api/customer/notifications/route'

describe('customer notifications route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFns.requireCustomerAuth.mockResolvedValue({
      session: { id: 'cust-1' },
    })
  })

  it('returns unread ticket notifications and unread announcement counts from one payload', async () => {
    prismaMock.supportTickets.count.mockResolvedValueOnce(2)
    prismaMock.supportTickets.findMany.mockResolvedValueOnce([
      {
        id: 'ticket-1',
        ticketNumber: 'TIC-001',
        subject: 'Internet down',
        status: 'WAITING_CUSTOMER',
        replies: [
          {
            id: 'reply-1',
            message: 'Sudah kami cek',
            createdAt: new Date('2026-03-08T08:00:00.000Z'),
            user: { name: 'Admin 1' },
          },
        ],
      },
    ])
    prismaMock.announcement.count.mockResolvedValueOnce(1)
    prismaMock.announcement.findMany.mockResolvedValueOnce([
      {
        id: 'ann-1',
        title: 'Info Gangguan',
        content: 'Ada maintenance malam ini',
        isPinned: true,
        createdAt: new Date('2026-03-08T07:00:00.000Z'),
      },
    ])

    const response = await GET(new NextRequest('http://localhost/api/customer/notifications?limit=5'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.unreadTicketCount).toBe(2)
    expect(json.unreadAnnouncementCount).toBe(1)
    expect(json.unreadCount).toBe(3)
    expect(json.notifications).toEqual([
      expect.objectContaining({
        id: 'ticket-reply-reply-1',
        isRead: false,
        ticketId: 'ticket-1',
      }),
    ])
    expect(json.announcements).toEqual([
      expect.objectContaining({
        id: 'ann-1',
        title: 'Info Gangguan',
      }),
    ])
  })

  it('returns auth response when customer auth fails', async () => {
    mockFns.requireCustomerAuth.mockResolvedValueOnce({
      response: NextResponse.json({ success: false }, { status: 401 }),
    })

    const response = await GET(new NextRequest('http://localhost/api/customer/notifications'))

    expect(response.status).toBe(401)
  })
})
