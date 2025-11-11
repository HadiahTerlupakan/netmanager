/**
 * Integration Tests untuk Health Check API
 */

import { describe, it, expect } from 'vitest'
import { createMockRequest, getResponseData } from '../../helpers/api-test-helper'

describe('Health Check API Integration Tests', () => {
  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const { GET } = await import('@/app/api/health/route')
      const req = createMockRequest('GET', '/api/health')
      const response = await GET(req)

      expect(response.status).toBe(200)
      const data = await getResponseData(response)
      
      expect(data).toHaveProperty('status')
      expect(data).toHaveProperty('timestamp')
      expect(data).toHaveProperty('services')
      expect(data.services).toHaveProperty('database')
      expect(data.services).toHaveProperty('redis')
      expect(data).toHaveProperty('uptime')
      expect(data).toHaveProperty('memory')
    })

    it('should return database status', async () => {
      const { GET } = await import('@/app/api/health/route')
      const req = createMockRequest('GET', '/api/health')
      const response = await GET(req)
      const data = await getResponseData(response)

      expect(data.services.database).toHaveProperty('status')
      expect(data.services.database).toHaveProperty('responseTime')
      expect(['healthy', 'unhealthy']).toContain(data.services.database.status)
    })

    it('should return redis status', async () => {
      const { GET } = await import('@/app/api/health/route')
      const req = createMockRequest('GET', '/api/health')
      const response = await GET(req)
      const data = await getResponseData(response)

      expect(data.services.redis).toHaveProperty('status')
      expect(data.services.redis).toHaveProperty('responseTime')
      expect(['healthy', 'unhealthy']).toContain(data.services.redis.status)
    })

    it('should return memory information', async () => {
      const { GET } = await import('@/app/api/health/route')
      const req = createMockRequest('GET', '/api/health')
      const response = await GET(req)
      const data = await getResponseData(response)

      expect(data.memory).toHaveProperty('used')
      expect(data.memory).toHaveProperty('total')
      expect(data.memory).toHaveProperty('unit')
      expect(data.memory.unit).toBe('MB')
      expect(typeof data.memory.used).toBe('number')
      expect(typeof data.memory.total).toBe('number')
    })
  })
})

