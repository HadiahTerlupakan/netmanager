import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockJwtVerify = vi.hoisted(() => vi.fn())
const mockEvaluateVersionAccess = vi.hoisted(() => vi.fn())
const mockUserFindUnique = vi.hoisted(() => vi.fn())
const mockPelangganFindUnique = vi.hoisted(() => vi.fn())
const mockMitraFindUnique = vi.hoisted(() => vi.fn())

vi.mock('jose', () => ({
  jwtVerify: mockJwtVerify,
  SignJWT: class {
    setProtectedHeader() { return this }
    setIssuedAt() { return this }
    setExpirationTime() { return this }
    async sign() { return 'signed-token' }
  }
}))

vi.mock('@/modules/app-version/services/AppVersionService', () => ({
  getAppVersionService: () => ({
    evaluateVersionAccess: mockEvaluateVersionAccess
  })
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique
    },
    pelanggan: {
      findUnique: mockPelangganFindUnique
    }
  },
  prismaAuth: {
    user: {
      findUnique: mockUserFindUnique
    },
    pelanggan: {
      findUnique: mockPelangganFindUnique
    }
  }
}))

vi.mock('@/lib/prisma-mitra', () => ({
  prismaMitra: {
    mitra: {
      findUnique: mockMitraFindUnique
    }
  },
  prismaMitraAuth: {
    mitra: {
      findUnique: mockMitraFindUnique
    }
  }
}))

import { getMobileTokenDetails, verifyMobileToken } from '@/lib/mobile-auth'

describe('mobile-auth version overrides', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPelangganFindUnique.mockResolvedValue(null)
    mockMitraFindUnique.mockResolvedValue(null)
  })

  it('uses explicit version override when reading token details', async () => {
    mockJwtVerify.mockResolvedValueOnce({
      payload: { sub: 'user-1', tokenVersion: 1, appVersionCode: 54 }
    })
    mockEvaluateVersionAccess.mockResolvedValueOnce({
      isSupported: true,
      updateAvailable: false,
      isForceUpdate: false,
      currentVersion: '1.0.60',
      currentVersionCode: 100,
      minimumVersion: null,
      latestVersion: null
    })

    const details = await getMobileTokenDetails('token-1', 100)

    expect(details?.versionCode).toBe(100)
    expect(mockEvaluateVersionAccess).toHaveBeenCalledWith(100)
  })

  it('accepts a supported request version even when token appVersionCode is stale', async () => {
    mockJwtVerify.mockResolvedValueOnce({
      payload: { sub: 'user-1', tokenVersion: 2, appVersionCode: 54 }
    })
    mockEvaluateVersionAccess.mockResolvedValueOnce({
      isSupported: true,
      updateAvailable: false,
      isForceUpdate: false,
      currentVersion: '1.0.60',
      currentVersionCode: 100,
      minimumVersion: null,
      latestVersion: null
    })
    mockUserFindUnique.mockResolvedValueOnce({
      tokenVersion: 2,
      isActive: true,
      isSales: false,
      siteId: null,
      role: {
        name: 'ADMIN',
        permission: []
      }
    })

    const payload = await verifyMobileToken('token-1', 100)

    expect(payload?.userId).toBe('user-1')
    expect(mockEvaluateVersionAccess).toHaveBeenCalledWith(100)
  })
})
