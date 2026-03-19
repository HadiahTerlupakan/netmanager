import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prismaMock } from '../setup'

const mockGetMobileAuthPayload = vi.fn()

vi.mock('@/lib/mobile-api-auth', () => ({
  getMobileAuthPayload: (request: Request) => mockGetMobileAuthPayload(request)
}))

import { POST } from '@/app/api/mobile/app-version/report/route'

describe('POST /api/mobile/app-version/report', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects non-numeric versionCode values', async () => {
    mockGetMobileAuthPayload.mockResolvedValueOnce({ id: 'mitra-1', role: 'MITRA' })

    const request = new NextRequest('http://localhost/api/mobile/app-version/report', {
      method: 'POST',
      body: JSON.stringify({ versionCode: '77abc', versionName: '1.0.77' }),
      headers: { 'content-type': 'application/json' }
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({
      success: false,
      error: 'versionCode harus berupa angka bulat positif',
      code: 'VALIDATION_ERROR'
    })
    expect(prismaMock.mitra.update).not.toHaveBeenCalled()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(prismaMock.pelanggan.update).not.toHaveBeenCalled()
  })

  it('updates mitra version snapshot for authenticated mitra users', async () => {
    mockGetMobileAuthPayload.mockResolvedValueOnce({ id: 'mitra-1', role: 'MITRA' })
    prismaMock.mitra.update.mockResolvedValueOnce({ id: 'mitra-1' })

    const request = new NextRequest('http://localhost/api/mobile/app-version/report', {
      method: 'POST',
      body: JSON.stringify({ versionCode: '77', versionName: '1.0.77' }),
      headers: { 'content-type': 'application/json' }
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true })
    expect(prismaMock.mitra.update).toHaveBeenCalledTimes(1)
    expect(prismaMock.mitra.update).toHaveBeenCalledWith({
      where: { id: 'mitra-1' },
      data: expect.objectContaining({
        lastVersionCode: 77,
        lastVersionName: '1.0.77',
        lastVersionUpdate: expect.any(Date)
      })
    })
  })
})
