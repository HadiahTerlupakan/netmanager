import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { AppError } from '@/lib/errors'

describe('Global Error Handler', () => {
  const app = new Hono().basePath('/api')

  app.onError((err, c) => {
    console.error(err)
    if (err instanceof AppError) {
      return c.json(
        { error: err.message, code: err.code, ...((err.details as Record<string, unknown>) ?? {}) },
        err.statusCode as ContentfulStatusCode
      )
    }
    return c.json({ error: err.message || 'Internal Server Error' }, 500)
  })

  // Register all routes before any request is made (Hono SmartRouter requirement)
  beforeAll(() => {
    app.get('/test-error', () => { throw new AppError('Test error', 418, 'TEST') })
    app.get('/test-generic', () => { throw new Error('Generic error') })
  })

  it('should handle AppError with correct status', async () => {
    const res = await app.request('/api/test-error')
    expect(res.status).toBe(418)
    const body = await res.json()
    expect(body.error).toBe('Test error')
    expect(body.code).toBe('TEST')
  })

  it('should handle generic Error with 500', async () => {
    const res = await app.request('/api/test-generic')
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Generic error')
  })
})
