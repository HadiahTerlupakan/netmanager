import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export interface AdvancedRateLimitOptions {
  maxRequests: number
  windowSeconds: number
  algorithm?: 'fixed-window' | 'sliding-window' | 'token-bucket' | 'exponential-backoff'
  keyGenerator?: (req: NextRequest) => string
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  customResponse?: (retryAfter: number) => NextResponse
  enableBurstProtection?: boolean
  burstLimit?: number
}

interface RateLimitInfo {
  count: number
  resetTime: number
  firstRequest: number
  lastRequest: number
  consecutiveHits: number
}

// In-memory fallback (for when Redis is unavailable)
const memoryStore = new Map<string, RateLimitInfo>()

/**
 * Advanced Rate Limiting dengan multiple algorithms
 */
export class AdvancedRateLimiter {
  private algorithm: AdvancedRateLimitOptions['algorithm']
  private skipSuccessful: boolean
  private skipFailed: boolean
  private enableBurstProtection: boolean
  private burstLimit: number

  constructor(options: Partial<AdvancedRateLimitOptions> = {}) {
    this.algorithm = options.algorithm || 'sliding-window'
    this.skipSuccessful = options.skipSuccessfulRequests || false
    this.skipFailed = options.skipFailedRequests || false
    this.enableBurstProtection = options.enableBurstProtection || false
    this.burstLimit = options.burstLimit || Math.floor((options.maxRequests || 100) / 10)
  }

  /**
   * Check rate limit using specified algorithm
   */
  async checkRateLimit(
    key: string,
    maxRequests: number,
    windowSeconds: number,
    request: NextRequest
  ): Promise<{ allowed: boolean; retryAfter: number; remaining: number; resetTime: number }> {
    try {
      switch (this.algorithm) {
        case 'sliding-window':
          return await this.slidingWindowAlgorithm(key, maxRequests, windowSeconds, request)
        case 'token-bucket':
          return await this.tokenBucketAlgorithm(key, maxRequests, windowSeconds, request)
        case 'exponential-backoff':
          return await this.exponentialBackoffAlgorithm(key, maxRequests, windowSeconds, request)
        default:
          return await this.fixedWindowAlgorithm(key, maxRequests, windowSeconds, request)
      }
    } catch (error) {
      console.error('Rate limiting error:', error)
      // Fail safe - allow request but log the error
      return { allowed: true, retryAfter: 0, remaining: maxRequests, resetTime: Date.now() + windowSeconds * 1000 }
    }
  }

  /**
   * Fixed Window Counter Algorithm
   */
  private async fixedWindowAlgorithm(
    key: string,
    maxRequests: number,
    windowSeconds: number,
    request: NextRequest
  ): Promise<{ allowed: boolean; retryAfter: number; remaining: number; resetTime: number }> {
    const now = Date.now()
    const windowStart = Math.floor(now / (windowSeconds * 1000)) * (windowSeconds * 1000)
    const resetTime = windowStart + (windowSeconds * 1000)

    let info = memoryStore.get(key)

    if (!info || info.resetTime !== windowStart) {
      info = {
        count: 0,
        resetTime,
        firstRequest: now,
        lastRequest: now,
        consecutiveHits: 0
      }
    }

    info.count++
    info.lastRequest = now

    // Check burst protection
    if (this.enableBurstProtection && info.count > this.burstLimit) {
      const retryAfter = Math.ceil((resetTime - now) / 1000)
      return { allowed: false, retryAfter, remaining: 0, resetTime }
    }

    memoryStore.set(key, info)

    const allowed = info.count <= maxRequests
    const remaining = Math.max(0, maxRequests - info.count)
    const retryAfter = allowed ? 0 : Math.ceil((resetTime - now) / 1000)

    return { allowed, retryAfter, remaining, resetTime }
  }

  /**
   * Sliding Window Algorithm
   */
  private async slidingWindowAlgorithm(
    key: string,
    maxRequests: number,
    windowSeconds: number,
    request: NextRequest
  ): Promise<{ allowed: boolean; retryAfter: number; remaining: number; resetTime: number }> {
    const now = Date.now()
    const windowMs = windowSeconds * 1000

    let info = memoryStore.get(key)

    if (!info) {
      info = {
        count: 0,
        resetTime: now + windowMs,
        firstRequest: now,
        lastRequest: now,
        consecutiveHits: 0
      }
    }

    // Remove old requests outside the sliding window
    const cutoff = now - windowMs
    if (info.firstRequest < cutoff) {
      info.count = 0
      info.firstRequest = now
      info.consecutiveHits = 0
    }

    info.count++
    info.lastRequest = now
    info.consecutiveHits++

    // Check burst protection
    if (this.enableBurstProtection && info.consecutiveHits > this.burstLimit) {
      const retryAfter = Math.ceil(windowSeconds)
      return { allowed: false, retryAfter, remaining: 0, resetTime: now + windowMs }
    }

    info.resetTime = now + windowMs
    memoryStore.set(key, info)

    const allowed = info.count <= maxRequests
    const remaining = Math.max(0, maxRequests - info.count)
    const retryAfter = allowed ? 0 : Math.ceil(windowSeconds)

    return { allowed, retryAfter, remaining, resetTime: info.resetTime }
  }

  /**
   * Token Bucket Algorithm
   */
  private async tokenBucketAlgorithm(
    key: string,
    maxRequests: number,
    windowSeconds: number,
    request: NextRequest
  ): Promise<{ allowed: boolean; retryAfter: number; remaining: number; resetTime: number }> {
    const now = Date.now()
    const refillRate = maxRequests / windowSeconds // tokens per second
    const bucketCapacity = maxRequests

    let info = memoryStore.get(key)

    if (!info) {
      info = {
        count: bucketCapacity, // Start with full bucket
        resetTime: now,
        firstRequest: now,
        lastRequest: now,
        consecutiveHits: 0
      }
    }

    // Refill tokens based on time elapsed
    const timePassed = (now - info.lastRequest) / 1000
    const tokensToAdd = Math.floor(timePassed * refillRate)
    info.count = Math.min(bucketCapacity, info.count + tokensToAdd)

    // Check burst protection
    if (this.enableBurstProtection && info.consecutiveHits > this.burstLimit && info.count < 1) {
      const retryAfter = Math.ceil(1 / refillRate) // Time to get 1 token
      return { allowed: false, retryAfter, remaining: 0, resetTime: now + retryAfter * 1000 }
    }

    const allowed = info.count >= 1
    if (allowed) {
      info.count--
      info.consecutiveHits++
    } else {
      info.consecutiveHits = 0
    }

    info.lastRequest = now
    info.resetTime = now + Math.ceil((bucketCapacity - info.count) / refillRate) * 1000
    memoryStore.set(key, info)

    const remaining = Math.max(0, info.count)
    const retryAfter = allowed ? 0 : Math.ceil(1 / refillRate)

    return { allowed, retryAfter, remaining, resetTime: info.resetTime }
  }

  /**
   * Exponential Backoff Algorithm
   */
  private async exponentialBackoffAlgorithm(
    key: string,
    maxRequests: number,
    windowSeconds: number,
    request: NextRequest
  ): Promise<{ allowed: boolean; retryAfter: number; remaining: number; resetTime: number }> {
    const now = Date.now()

    let info = memoryStore.get(key)

    if (!info) {
      info = {
        count: 0,
        resetTime: now + (windowSeconds * 1000),
        firstRequest: now,
        lastRequest: now,
        consecutiveHits: 0
      }
    }

    // Check if we're in backoff period
    if (info.consecutiveHits > 0) {
      const backoffTime = Math.min(
        Math.pow(2, info.consecutiveHits - 1) * 1000, // 2^n seconds, max 1 hour
        3600 * 1000
      )
      const backoffEnd = info.lastRequest + backoffTime

      if (now < backoffEnd) {
        const retryAfter = Math.ceil((backoffEnd - now) / 1000)
        return { allowed: false, retryAfter, remaining: 0, resetTime: backoffEnd }
      }
    }

    // Use sliding window for normal rate limiting
    const windowMs = windowSeconds * 1000
    const cutoff = now - windowMs

    if (info.firstRequest < cutoff) {
      info.count = 0
      info.firstRequest = now
      info.consecutiveHits = 0
    }

    info.count++
    info.lastRequest = now

    const allowed = info.count <= maxRequests

    if (!allowed) {
      info.consecutiveHits++
    } else {
      info.consecutiveHits = 0
    }

    info.resetTime = now + windowMs
    memoryStore.set(key, info)

    const remaining = Math.max(0, maxRequests - info.count)
    const retryAfter = allowed ? 0 : Math.ceil(windowSeconds)

    return { allowed, retryAfter, remaining, resetTime: info.resetTime }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now()
    const expiredKeys: string[] = []

    for (const [key, info] of memoryStore.entries()) {
      if (now > info.resetTime + 300000) { // Keep for 5 minutes after expiry
        expiredKeys.push(key)
      }
    }

    expiredKeys.forEach(key => memoryStore.delete(key))
  }
}

// Global rate limiter instance
const globalRateLimiter = new AdvancedRateLimiter()

// Run cleanup every 5 minutes
setInterval(() => {
  globalRateLimiter.cleanup()
}, 5 * 60 * 1000)

/**
 * Advanced rate limiting middleware
 */
export async function advancedRateLimit(
  request: NextRequest,
  options: AdvancedRateLimitOptions
): Promise<NextResponse | null> {
  try {
    const {
      maxRequests,
      windowSeconds,
      algorithm = 'sliding-window',
      keyGenerator = defaultKeyGenerator,
      customResponse,
      enableBurstProtection = false,
      burstLimit = Math.floor(maxRequests / 10)
    } = options

    const key = keyGenerator(request)
    if (!key) {
      return null
    }

    // Use appropriate rate limiter instance
    const rateLimiter = new AdvancedRateLimiter({
      algorithm,
      enableBurstProtection,
      burstLimit,
      skipSuccessfulRequests: options.skipSuccessfulRequests,
      skipFailedRequests: options.skipFailedRequests
    })

    const result = await rateLimiter.checkRateLimit(key, maxRequests, windowSeconds, request)

    if (!result.allowed) {
      if (customResponse) {
        return customResponse(result.retryAfter)
      }

      return NextResponse.json({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter: result.retryAfter,
        limit: maxRequests,
        window: windowSeconds,
        remaining: result.remaining
      }, {
        status: 429,
        headers: {
          'Retry-After': String(result.retryAfter),
          'X-RateLimit-Limit': String(maxRequests),
          'X-RateLimit-Remaining': String(result.remaining),
          'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
          'X-RateLimit-Window': String(windowSeconds)
        }
      })
    }

    // Add rate limit headers to successful responses
    const responseHeaders = new Headers()
    responseHeaders.set('X-RateLimit-Limit', String(maxRequests))
    responseHeaders.set('X-RateLimit-Remaining', String(result.remaining))
    responseHeaders.set('X-RateLimit-Reset', String(Math.ceil(result.resetTime / 1000)))

    return null
  } catch (error) {
    console.error('Advanced rate limit error:', error)
    return null
  }
}

/**
 * Default key generator
 */
function defaultKeyGenerator(request: NextRequest): string {
  // Try to get user ID first for more specific rate limiting
  const userId = request.headers.get('x-user-id') ||
    request.cookies.get('user-id')?.value ||
    request.cookies.get('next-auth.session-token')?.value

  if (userId) {
    return `rate-limit:user:${crypto.createHash('sha256').update(userId).digest('hex').substring(0, 16)}`
  }

  // Fallback to IP address
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const ip = (request as any).ip

  const clientIp = forwardedFor
    ? forwardedFor.split(',')[0]?.trim()
    : realIp || ip || 'unknown'

  return `rate-limit:ip:${crypto.createHash('sha256').update(clientIp).digest('hex').substring(0, 16)}`
}

/**
 * Pre-configured rate limiters for different use cases
 */
export const rateLimiters = {
  authentication: {
    maxRequests: 5,
    windowSeconds: 300, // 5 per 5 minutes
    algorithm: 'exponential-backoff' as const,
    enableBurstProtection: true,
    burstLimit: 2
  },

  api: {
    maxRequests: 100,
    windowSeconds: 60, // 100 per minute
    algorithm: 'sliding-window' as const,
    enableBurstProtection: true,
    burstLimit: 20
  },

  fileUpload: {
    maxRequests: 10,
    windowSeconds: 300, // 10 per 5 minutes
    algorithm: 'token-bucket' as const,
    enableBurstProtection: true,
    burstLimit: 3
  },

  financial: {
    maxRequests: 50,
    windowSeconds: 60, // 50 per minute
    algorithm: 'sliding-window' as const,
    enableBurstProtection: true,
    burstLimit: 10
  },

  admin: {
    maxRequests: 200,
    windowSeconds: 60, // 200 per minute
    algorithm: 'token-bucket' as const,
    enableBurstProtection: true,
    burstLimit: 40
  }
}

export default AdvancedRateLimiter