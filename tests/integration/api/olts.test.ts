/**
 * Integration Tests untuk OLTs API
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createTestAdmin, createTestOlt, cleanupTestDatabase, createMockSession } from '@/lib/test-utils'
import { createMockRequest, getResponseData } from '../../helpers/api-test-helper'

// Mock NextAuth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

// Mock auth config
vi.mock('@/lib/auth', () => ({
  authConfig: {},
}))

describe('OLTs API Integration Tests', () => {
  let adminUser: any
  let mockSession: any

  beforeAll(async () => {
    adminUser = await createTestAdmin()
    mockSession = createMockSession(adminUser)
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  describe('GET /api/olts', () => {
    it('should return 401 if not authenticated', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValue(null)

      const { GET } = await import('@/app/api/olts/route')
      const req = createMockRequest('GET', '/api/olts')
      const response = await GET(req)

      expect(response.status).toBe(401)
    })

    it('should return OLTs list for authenticated admin', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValue(mockSession)

      const { GET } = await import('@/app/api/olts/route')
      const req = createMockRequest('GET', '/api/olts')
      const response = await GET(req)

      expect(response.status).toBe(200)
      const data = await getResponseData(response)
      expect(data).toHaveProperty('olts')
      expect(Array.isArray(data.olts)).toBe(true)
    })
  })

  describe('POST /api/olts', () => {
    it('should return 401 if not authenticated', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValue(null)

      const { POST } = await import('@/app/api/olts/route')
      const req = createMockRequest('POST', '/api/olts', {
        name: 'Test OLT',
        ipAddress: '192.168.1.100',
        type: 'ZTE-C300',
        telnetPassword: 'password123',
      })
      const response = await POST(req)

      expect(response.status).toBe(401)
    })

    it('should create new OLT for authenticated admin', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValue(mockSession)

      const { POST } = await import('@/app/api/olts/route')
      const req = createMockRequest('POST', '/api/olts', {
        name: `Test OLT ${Date.now()}`,
        ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
        type: 'ZTE-C300',
        telnetPassword: 'password123',
      })
      const response = await POST(req)

      expect(response.status).toBe(200)
      const data = await getResponseData(response)
      expect(data).toHaveProperty('id')
    })

    it('should return 400 for invalid data', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValue(mockSession)

      const { POST } = await import('@/app/api/olts/route')
      const req = createMockRequest('POST', '/api/olts', {
        // Missing required fields
        name: 'Test',
      })
      const response = await POST(req)

      expect(response.status).toBe(400)
    })

    it('should return 409 for duplicate IP address', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValue(mockSession)

      const ipAddress = `192.168.1.${Math.floor(Math.random() * 255)}`
      const { POST } = await import('@/app/api/olts/route')
      
      // Create first OLT
      const req1 = createMockRequest('POST', '/api/olts', {
        name: `Test OLT 1 ${Date.now()}`,
        ipAddress,
        type: 'ZTE-C300',
        telnetPassword: 'password123',
      })
      await POST(req1)

      // Try create OLT with same IP
      const req2 = createMockRequest('POST', '/api/olts', {
        name: `Test OLT 2 ${Date.now()}`,
        ipAddress, // Same IP
        type: 'ZTE-C300',
        telnetPassword: 'password123',
      })
      const response = await POST(req2)

      expect(response.status).toBe(409)
    })
  })
})

