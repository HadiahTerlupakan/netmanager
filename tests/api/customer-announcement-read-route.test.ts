import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { prismaMock } from '../setup'

const mockFns = vi.hoisted(() => ({
  requireCustomerAuth: vi.fn(),
}))

vi.mock('@/lib/customer-auth', () => ({
  requireCustomerAuth: mockFns.requireCustomerAuth,
}))

import { POST } from '@/app/api/customer/announcements/[id]/read/route'

describe('customer announcement read route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFns.requireCustomerAuth.mockResolvedValue({
      session: { id: 'cust-1' },
    })
  })

  it('marks customer announcement reads using pelanggan ownership', async () => {
    prismaMock.announcement.findUnique.mockResolvedValueOnce({ id: 'ann-1' })
    prismaMock.announcementRead.upsert.mockResolvedValueOnce({ id: 'read-1' })

    const response = await POST(new NextRequest('http://localhost/api/customer/announcements/ann-1/read', {
      method: 'POST',
      body: JSON.stringify({ portal: 'customer' }),
      headers: { 'content-type': 'application/json' },
    }), { params: Promise.resolve({ id: 'ann-1' }) })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(prismaMock.announcementRead.upsert).toHaveBeenCalledWith({
      where: {
        announcementId_pelangganId: {
          announcementId: 'ann-1',
          pelangganId: 'cust-1',
        },
      },
      update: {
        readAt: expect.any(Date),
      },
      create: {
        announcementId: 'ann-1',
        pelangganId: 'cust-1',
        portal: 'customer',
      },
    })
    expect(json.success).toBe(true)
  })

  it('returns customer auth failure responses unchanged', async () => {
    mockFns.requireCustomerAuth.mockResolvedValueOnce({
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })

    const response = await POST(new NextRequest('http://localhost/api/customer/announcements/ann-1/read', {
      method: 'POST',
    }), { params: Promise.resolve({ id: 'ann-1' }) })

    expect(response.status).toBe(401)
  })
})
