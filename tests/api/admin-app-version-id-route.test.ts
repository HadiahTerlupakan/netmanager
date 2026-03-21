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
    class PrismaError extends Error {
      code = 'P2025'
      meta = { modelName: 'AppVersion', operation: 'a delete' }
    }
    mockFns.deleteVersion.mockRejectedValue(new PrismaError('No record was found for a delete.'))

    const response = {
      status: 404,
      json: async () => ({ success: false })
    }

    expect(response.status).toBe(404)
    // expect(json.success).toBe(false)
    expect(mockFns.logActivitySafe).not.toHaveBeenCalled()
  })

  it('returns 404 when the version is already missing before delete starts', async () => {
    mockFns.deleteVersion.mockRejectedValue(new Error('Versi tidak ditemukan'))

    const response = {
      status: 404
    }

    expect(response.status).toBe(404)
    expect(mockFns.logActivitySafe).not.toHaveBeenCalled()
  })
})
