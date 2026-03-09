import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prismaMock } from '../setup'

const mockEnsurePermission = vi.fn()

vi.mock('@/lib/rbac', () => ({
  ensurePermission: (...args: unknown[]) => mockEnsurePermission(...args)
}))

vi.mock('@/lib/api', () => ({
  createHandler: (_options: unknown, handler: (req: Request, ctx: unknown) => unknown) => handler,
  apiSuccess: <T>(data: T) => data
}))

import { GET } from '@/app/api/admin/app-version/stats/route'

describe('GET /api/admin/app-version/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('includes active mitra counts in version statistics', async () => {
    prismaMock.appVersion.findFirst.mockResolvedValueOnce({
      version: '1.0.77',
      versionCode: 77,
      isActive: true
    })

    prismaMock.user.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4)

    prismaMock.pelanggan.count
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(7)

    prismaMock.mitra.count
      .mockResolvedValueOnce(11)
      .mockResolvedValueOnce(13)
      .mockResolvedValueOnce(17)

    const result = await GET(
      new NextRequest('http://localhost/api/admin/app-version/stats'),
      { params: Promise.resolve({}) }
    )

    expect(mockEnsurePermission).toHaveBeenCalledWith('app_version:read')
    expect(prismaMock.mitra.count).toHaveBeenNthCalledWith(1, {
      where: {
        isActive: true,
        lastVersionCode: { gte: 77 }
      }
    })
    expect(prismaMock.mitra.count).toHaveBeenNthCalledWith(2, {
      where: {
        isActive: true,
        lastVersionCode: { lt: 77 }
      }
    })
    expect(prismaMock.mitra.count).toHaveBeenNthCalledWith(3, {
      where: {
        isActive: true,
        lastVersionCode: null
      }
    })
    expect(result).toEqual({
      updatedCount: 18,
      outdatedCount: 22,
      unknownCount: 28,
      latestVersion: {
        version: '1.0.77',
        versionCode: 77
      }
    })
  })
})
