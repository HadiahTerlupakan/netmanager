import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { prismaMock } from '../setup'

const { mockAuthenticateMobileRequest, mockLoggerError } = vi.hoisted(() => ({
  mockAuthenticateMobileRequest: vi.fn(),
  mockLoggerError: vi.fn(),
}))

vi.mock('@/lib/mobile-api-auth', () => ({
  authenticateMobileRequest: (request: Request) => mockAuthenticateMobileRequest(request),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: mockLoggerError,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

import { POST } from '@/app/api/mobile/error-report/route'

describe('POST /api/mobile/error-report', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.systemLog.create.mockResolvedValue({
      id: 'log-1',
      type: 'SYSTEM',
      action: 'MOBILE_ERROR_REPORT',
      subject: 'network',
      details: '{}',
      userId: null,
      ipAddress: null,
      userAgent: null,
      createdAt: new Date(),
    } as never)
  })

  it('returns 400 when required fields are missing', async () => {
    const request = new NextRequest('http://localhost/api/mobile/error-report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'network', source: 'query' }),
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json).toEqual({ error: 'message wajib diisi' })
    expect(prismaMock.systemLog.create).not.toHaveBeenCalled()
  })

  it('stores anonymous mobile error reports when no auth header is present', async () => {
    const request = new NextRequest('http://localhost/api/mobile/error-report', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Vitest',
      },
      body: JSON.stringify({
        message: 'Network request failed',
        kind: 'network',
        source: 'query',
        severity: 'error',
        route: '/(customer)/tickets',
        screen: 'CustomerTicketsScreen',
      }),
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ success: true })
    expect(mockAuthenticateMobileRequest).not.toHaveBeenCalled()
    expect(prismaMock.systemLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'SYSTEM',
          action: 'MOBILE_ERROR_REPORT',
          subject: 'network',
          userId: null,
          userAgent: 'Vitest',
          details: expect.stringContaining('Network request failed'),
        }),
      })
    )
    expect(mockLoggerError).toHaveBeenCalled()
  })

  it('enriches report with authenticated user when auth header is valid', async () => {
    mockAuthenticateMobileRequest.mockResolvedValue({
      payload: {
        userId: 'user-123',
        role: 'ADMIN',
        email: 'user@example.com',
        tenant: 'tenant-a',
      },
    })

    const request = new NextRequest('http://localhost/api/mobile/error-report', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer token',
      },
      body: JSON.stringify({
        message: 'Sync replay failed',
        kind: 'sync',
        source: 'sync',
        severity: 'error',
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockAuthenticateMobileRequest).toHaveBeenCalledTimes(1)
    expect(prismaMock.systemLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-123',
          details: expect.stringContaining('tenant-a'),
        }),
      })
    )
  })
})
