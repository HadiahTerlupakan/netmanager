/**
 * API Integration Tests - Response Format Verification
 * 
 * These tests verify actual HTTP responses from the API endpoints
 * using fetch calls to the running dev server.
 * 
 * Prerequisites:
 * - Dev server running on localhost:3000
 */

import { describe, it, expect } from 'vitest'

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'

// Helper to check if server is running
async function isServerRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { method: 'GET' })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Standard API response structure based on lib/api-response.ts
 *
 * Success: { success: true, data: T, message?: string }
 * Error: { success: false, error: string, code: string, details?: {} }
 */
interface _ApiSuccessResponse<T = unknown> {
  success: true
  data: T
  message?: string
}

interface _ApiErrorResponse {
  success: false
  error: string
  code: string
  details?: Record<string, unknown>
}

describe.skipIf(!await isServerRunning())('API Response Format Integration Tests', () => {
  describe('Health Endpoints', () => {
    // Note: /api/health returns custom format, not standard apiSuccess
    it('GET /api/health should return health status', async () => {
      const res = await fetch(`${BASE_URL}/api/health`)
      const json = await res.json()
      
      expect(res.status).toBe(200)
      expect(json).toHaveProperty('success', true)
      expect(json.data).toHaveProperty('status')
    })

    it('GET /api/health/memory should return memory metrics', async () => {
      const res = await fetch(`${BASE_URL}/api/health/memory`)
      const json = await res.json()
      
      expect(res.status).toBe(200)
      // Memory endpoint uses standard format with data wrapper
      expect(json).toHaveProperty('success', true)
      // Actual structure: data.memory.heapUsed
      expect(json.data).toHaveProperty('memory')
      expect(json.data.memory).toHaveProperty('heapUsed')
      expect(json.data.memory).toHaveProperty('rss')
    })
  })

  describe('Protected Endpoints - 401 Unauthorized', () => {
    const protectedEndpoints = [
      { method: 'GET', path: '/api/payments' },
      { method: 'GET', path: '/api/integrations/mixradius/customers' },
      { method: 'GET', path: '/api/integrations/mixradius/sessions' },
      { method: 'GET', path: '/api/integrations/mixradius/owners' },
      { method: 'GET', path: '/api/integrations/mixradius/groups' },
    ]

    protectedEndpoints.forEach(({ method, path }) => {
      it(`${method} ${path} should return 401 with standard error format`, async () => {
        const res = await fetch(`${BASE_URL}${path}`, { method })
        const json = await res.json()
        
        expect(res.status).toBe(401)
        expect(json).toHaveProperty('success', false)
        // Based on lib/api-response.ts: error is a string, code is separate
        expect(json).toHaveProperty('error')
        expect(json).toHaveProperty('code')
        expect(typeof json.error).toBe('string')
        expect(json.code).toBe('UNAUTHORIZED')
      })
    })
  })
})

/**
 * Manual Response Format Validator
 * Based on actual lib/api-response.ts format
 */
export function validateSuccessResponse(json: unknown): boolean {
  const data = json as { success?: boolean; data?: unknown }
  return (
    typeof json === 'object' &&
    json !== null &&
    data.success === true &&
    'data' in data
  )
}

export function validateErrorResponse(json: unknown): boolean {
  const data = json as { success?: boolean; error?: string; code?: string }
  return (
    typeof json === 'object' &&
    json !== null &&
    data.success === false &&
    typeof data.error === 'string' &&
    typeof data.code === 'string'
  )
}

describe('Response Validators', () => {
  it('validateSuccessResponse works correctly', () => {
    expect(validateSuccessResponse({ success: true, data: {} })).toBe(true)
    expect(validateSuccessResponse({ success: true, data: [], message: 'ok' })).toBe(true)
    expect(validateSuccessResponse({ success: false, data: {} })).toBe(false)
    expect(validateSuccessResponse({ data: {} })).toBe(false)
  })

  it('validateErrorResponse works correctly', () => {
    // Based on actual format: { success: false, error: string, code: string }
    expect(validateErrorResponse({ 
      success: false, 
      error: 'Unauthorized', 
      code: 'UNAUTHORIZED' 
    })).toBe(true)
    
    expect(validateErrorResponse({ 
      success: false, 
      error: 'Invalid input', 
      code: 'VALIDATION_ERROR', 
      details: {} 
    })).toBe(true)
    
    expect(validateErrorResponse({ success: true, error: 'test', code: 'X' })).toBe(false)
    expect(validateErrorResponse({ success: false })).toBe(false)
  })
})
