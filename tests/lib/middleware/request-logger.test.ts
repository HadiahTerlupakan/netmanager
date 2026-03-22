import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { logAuditActivity } from '@/lib/middleware/request-logger'
import { logger } from '@/lib/logger'

vi.mock('@/lib/logger', () => ({
  logger: {
    logActivity: vi.fn().mockResolvedValue(undefined),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}))

describe('logAuditActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createReq = (method: string, pathname: string) => {
    return new NextRequest(new URL(`http://localhost${pathname}`), { method })
  }

  const createRes = (status: number) => {
    return { status } as NextResponse
  }

  it('audits POST requests (write operation)', async () => {
    const req = createReq('POST', '/api/any-resource')
    const res = createRes(201)
    const body = { name: 'test' }

    await logAuditActivity(req, res, 'user-1', 'tenant-1', body)

    expect(logger.logActivity).toHaveBeenCalledWith(expect.objectContaining({
      action: 'CREATE',
      userId: 'user-1',
      tenantId: 'tenant-1',
      details: body
    }))
  })

  it('audits sensitive GET requests', async () => {
    const req = createReq('GET', '/api/admin/salary/123')
    const res = createRes(200)

    await logAuditActivity(req, res, 'user-1', 'tenant-1')

    expect(logger.logActivity).toHaveBeenCalledWith(expect.objectContaining({
      action: 'READ',
      subject: 'Admin Salary 123'
    }))
  })

  it('does NOT audit normal GET requests', async () => {
    const req = createReq('GET', '/api/public-info')
    const res = createRes(200)

    await logAuditActivity(req, res, 'user-1', 'tenant-1')

    expect(logger.logActivity).not.toHaveBeenCalled()
  })

  it('redacts sensitive fields in body', async () => {
    const req = createReq('POST', '/api/users')
    const res = createRes(201)
    const body = { 
      username: 'john', 
      password: 'secret123',
      nested: { secretRadius: 'key123' }
    }

    await logAuditActivity(req, res, 'user-1', 'tenant-1', body)

    expect(logger.logActivity).toHaveBeenCalledWith(expect.objectContaining({
      details: {
        username: 'john',
        password: '[REDACTED]',
        nested: { secretRadius: '[REDACTED]' }
      }
    }))
  })

  it('does NOT audit failed requests (status >= 400)', async () => {
    const req = createReq('POST', '/api/any')
    const res = createRes(400)

    await logAuditActivity(req, res, 'user-1', 'tenant-1', { data: 'fail' })

    expect(logger.logActivity).not.toHaveBeenCalled()
  })
})
