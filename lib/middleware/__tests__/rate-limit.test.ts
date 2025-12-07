import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getRateLimitConfig } from '../rate-limit'

describe('rate-limit utilities', () => {
  describe('getRateLimitConfig', () => {
    it('should return default config for unknown path', () => {
      const config = getRateLimitConfig('/api/unknown')
      expect(config.maxRequests).toBe(100)
      expect(config.windowSeconds).toBe(60)
    })

    it('should return specific config for /api/auth', () => {
      const config = getRateLimitConfig('/api/auth')
      expect(config.maxRequests).toBe(30)
      expect(config.windowSeconds).toBe(60)
    })

    it('should return specific config for /api/olts/test-connection', () => {
      const config = getRateLimitConfig('/api/olts/test-connection')
      expect(config.maxRequests).toBe(10)
      expect(config.windowSeconds).toBe(60)
    })

    it('should return specific config for /api/olts/onus/sync', () => {
      const config = getRateLimitConfig('/api/olts/onus/sync')
      expect(config.maxRequests).toBe(100)
      expect(config.windowSeconds).toBe(60)
    })

    it('should return specific config for /api/kmz', () => {
      const config = getRateLimitConfig('/api/kmz')
      expect(config.maxRequests).toBe(5)
      expect(config.windowSeconds).toBe(60)
    })

    it('should handle null and undefined pathname', () => {
      const config1 = getRateLimitConfig(null as any)
      const config2 = getRateLimitConfig(undefined as any)
      expect(config1.maxRequests).toBe(100)
      expect(config2.maxRequests).toBe(100)
    })

    it('should handle empty string pathname', () => {
      const config = getRateLimitConfig('')
      expect(config.maxRequests).toBe(100)
    })
  })
})

