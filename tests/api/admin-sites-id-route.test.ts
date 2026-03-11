import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  hasPermission: vi.fn(),
  deleteSite: vi.fn(),
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

vi.mock('@/modules/roles/services/SiteService', () => ({
  SiteService: class {
    deleteSite = mockFns.deleteSite
  },
}))

import { DELETE } from '@/app/api/admin/sites/[id]/route'

describe('admin site id route', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockFns.getServerSession.mockResolvedValue({
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        permissions: ['site:delete'],
      },
    })
    mockFns.getUserPermissions.mockResolvedValue(['site:delete'])
    mockFns.hasPermission.mockResolvedValue(true)
  })

  it('returns 404 when deleteSite reports missing site in Indonesian', async () => {
    mockFns.deleteSite.mockRejectedValue(new Error('Site tidak ditemukan'))

    const response = await DELETE(
      new NextRequest('http://localhost/api/admin/sites/site-1', {
        method: 'DELETE',
      }),
      {
        params: Promise.resolve({ id: 'site-1' }),
      }
    )

    expect(response.status).toBe(404)
  })
})
