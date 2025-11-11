/**
 * Integration Tests untuk Users API
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { createTestAdmin, cleanupTestDatabase, createMockSession } from '@/lib/test-utils'
import { createMockRequest, getResponseData } from '../../helpers/api-test-helper'

// Mock NextAuth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

// Mock auth config
vi.mock('@/lib/auth', () => ({
  authConfig: {},
}))

describe('Users API Integration Tests', () => {
  let adminUser: any
  let mockSession: any

  beforeAll(async () => {
    // Create test admin user
    adminUser = await createTestAdmin()
    mockSession = createMockSession(adminUser)
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  describe('GET /api/users', () => {
    it('should return 401 if not authenticated', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValue(null)

      // Import handler setelah mock
      const { GET } = await import('@/app/api/users/route')
      const req = createMockRequest('GET', '/api/users')
      const response = await GET(req)

      expect(response.status).toBe(401)
    })

    it('should return users list for authenticated admin', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValue(mockSession)

      const { GET } = await import('@/app/api/users/route')
      const req = createMockRequest('GET', '/api/users')
      const response = await GET(req)

      expect(response.status).toBe(200)
      const data = await getResponseData(response)
      expect(data).toHaveProperty('users')
      expect(Array.isArray(data.users)).toBe(true)
    })
  })

  describe('POST /api/users', () => {
    it('should return 401 if not authenticated', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValue(null)

      const { POST } = await import('@/app/api/users/route')
      const req = createMockRequest('POST', '/api/users', {
        email: 'newuser@example.com',
        password: 'Password123!',
        name: 'New User',
        role: 'USER',
      })
      const response = await POST(req)

      expect(response.status).toBe(401)
    })

    it('should create new user for authenticated admin', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValue(mockSession)

      const { POST } = await import('@/app/api/users/route')
      const req = createMockRequest('POST', '/api/users', {
        email: `newuser-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'New User',
        role: 'USER',
      })
      const response = await POST(req)

      expect(response.status).toBe(200)
      const data = await getResponseData(response)
      expect(data).toHaveProperty('id')
    })

    it('should return 400 for invalid data', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValue(mockSession)

      const { POST } = await import('@/app/api/users/route')
      const req = createMockRequest('POST', '/api/users', {
        email: 'invalid-email', // Invalid email
        password: '123', // Too short
      })
      const response = await POST(req)

      expect(response.status).toBe(400)
    })

    it('should return 409 for duplicate email', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValue(mockSession)

      // Create user pertama
      const email = `duplicate-${Date.now()}@example.com`
      const { POST } = await import('@/app/api/users/route')
      
      const req1 = createMockRequest('POST', '/api/users', {
        email,
        password: 'Password123!',
        name: 'User 1',
        role: 'USER',
      })
      await POST(req1)

      // Try create user dengan email yang sama
      const req2 = createMockRequest('POST', '/api/users', {
        email, // Same email
        password: 'Password123!',
        name: 'User 2',
        role: 'USER',
      })
      const response = await POST(req2)

      expect(response.status).toBe(409)
    })
  })
})

