import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prismaMock } from '../setup'

const mockGetServerSession = vi.hoisted(() => vi.fn())

vi.mock('next-auth', () => ({
  getServerSession: () => mockGetServerSession(),
}))

vi.mock('@/lib/auth', () => ({
  authConfig: {},
}))

import { DELETE } from '@/app/api/notifications/subscribe/route'

describe('notifications subscribe route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('only deactivates subscriptions owned by the authenticated user', async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: 'user-1' },
    })
    prismaMock.pushSubscriptions.updateMany.mockResolvedValueOnce({ count: 1 })

    const response = await DELETE(new NextRequest('http://localhost/api/notifications/subscribe', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint: 'https://push.example/sub-1' }),
      headers: { 'content-type': 'application/json' },
    }))
    const json = await response.json()

    expect(prismaMock.pushSubscriptions.updateMany).toHaveBeenCalledWith({
      where: {
        endpoint: 'https://push.example/sub-1',
        userId: 'user-1',
      },
      data: { isActive: false },
    })
    expect(json.success).toBe(true)
  })
})
