import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetMobileAuthPayload, mockFetchCustomersPPP } = vi.hoisted(() => ({
  mockGetMobileAuthPayload: vi.fn(),
  mockFetchCustomersPPP: vi.fn(),
}))

vi.mock('@/lib/mobile-api-auth', () => ({
  getMobileAuthPayload: (request: Request) => mockGetMobileAuthPayload(request),
}))

vi.mock('@/modules/integrations', () => {
  class MixRadiusConfigError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'MixRadiusConfigError'
    }
  }

  class MixRadiusService {
    fetchCustomersPPP = mockFetchCustomersPPP
  }

  return {
    MixRadiusConfigError,
    MixRadiusService,
  }
})

import { GET } from '@/app/api/mobile/mixradius/customers/route'

describe('GET /api/mobile/mixradius/customers', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockGetMobileAuthPayload.mockResolvedValue({
      permissions: ['m_mixradius:read'],
      siteId: 'site-1',
    })
  })

  it('returns a 503 when MixRadius config is invalid', async () => {
    const configError = new Error('Integrasi MixRadius belum dikonfigurasi')
    configError.name = 'MixRadiusConfigError'
    mockFetchCustomersPPP.mockRejectedValue(configError)

    const request = new NextRequest('http://localhost/api/mobile/mixradius/customers?search=yan')

    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(503)
    expect(json).toEqual({
      error: 'Integrasi MixRadius belum dikonfigurasi',
      code: 'MIXRADIUS_CONFIG_ERROR',
    })
  })

  it('keeps generic 500 mapping for unexpected search failures', async () => {
    mockFetchCustomersPPP.mockRejectedValue(new Error('unexpected upstream failure'))

    const request = new NextRequest('http://localhost/api/mobile/mixradius/customers?search=yan')

    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json).toEqual({ error: 'Gagal mencari pelanggan' })
  })
})
