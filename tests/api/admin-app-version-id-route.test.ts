import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  hasPermission: vi.fn(),
  deleteVersion: vi.fn(),
  logActivitySafe: vi.fn(),
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

vi.mock('@/modules/app-version', () => ({
  getAppVersionService: () => ({
    deleteVersion: mockFns.deleteVersion,
  }),
}))

vi.mock('@/lib/logger', () => ({
  logActivitySafe: mockFns.logActivitySafe,
}))

import { DELETE } from '@/app/api/admin/app-version/[id]/route'

describe('admin app version id route', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockFns.getServerSession.mockResolvedValue({
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        permissions: ['app_version:delete'],
      },
    })
    mockFns.getUserPermissions.mockResolvedValue(['app_version:delete'])
    mockFns.hasPermission.mockResolvedValue(true)
  })

  it('returns 404 when delete hits a Prisma missing-record race', async () => {
    mockFns.deleteVersion.mockRejectedValue(
      Object.assign(
        new Error(
          'Invalid `prisma.appVersion.delete()` invocation:\nNo record was found for a delete.'
        ),
        {
          code: 'P2025',
          meta: { modelName: 'AppVersion', operation: 'a delete' },
        }
      )
    )

    const response = await DELETE(
      new NextRequest('http://localhost/api/admin/app-version/ver-1', {
        method: 'DELETE',
      }),
      {
        params: Promise.resolve({ id: 'ver-1' }),
      }
    )
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.success).toBe(false)
    expect(mockFns.logActivitySafe).not.toHaveBeenCalled()
  })

  it('returns 404 when the version is already missing before delete starts', async () => {
    mockFns.deleteVersion.mockRejectedValue(new Error('Versi tidak ditemukan'))

    const response = await DELETE(
      new NextRequest('http://localhost/api/admin/app-version/ver-1', {
        method: 'DELETE',
      }),
      {
        params: Promise.resolve({ id: 'ver-1' }),
      }
    )

    expect(response.status).toBe(404)
    expect(mockFns.logActivitySafe).not.toHaveBeenCalled()
  })
})
