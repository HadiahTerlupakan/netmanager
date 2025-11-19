import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/redis'

export interface RateLimitOptions {
  maxRequests: number
  windowSeconds: number
  keyGenerator?: (req: NextRequest) => string
  message?: string
}

/**
 * Rate Limiting Middleware
 * 
 * @param options - Konfigurasi rate limiting
 * @returns Middleware function atau null jika rate limit tidak dilanggar
 */
export async function rateLimit(
  req: NextRequest,
  options: RateLimitOptions
): Promise<NextResponse | null> {
  try {
    const {
      maxRequests,
      windowSeconds,
      keyGenerator = (req) => {
        // Default: gunakan IP address
        const forwardedFor = req.headers.get('x-forwarded-for')
        const realIp = req.headers.get('x-real-ip')
        
        let ip = 'unknown'
        if (forwardedFor) {
          const ips = String(forwardedFor).split(',')
          ip = ips[0]?.trim() || 'unknown'
        } else if (realIp) {
          ip = String(realIp).trim() || 'unknown'
        }
        
        return `ratelimit:${ip}`
      },
      message = 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
    } = options

    const key = keyGenerator(req)
    if (!key || typeof key !== 'string' || key.length === 0) {
      // Jika key generator gagal, skip rate limiting
      return null
    }

    // Pastikan key adalah string yang valid
    const safeKey = String(key).trim()
    if (!safeKey || safeKey === 'undefined' || safeKey === 'null') {
      return null
    }

    const allowed = await checkRateLimit(safeKey, maxRequests, windowSeconds)

    if (!allowed) {
      return NextResponse.json(
        { 
          error: message,
          retryAfter: windowSeconds,
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(windowSeconds),
            'X-RateLimit-Limit': String(maxRequests),
            'X-RateLimit-Window': String(windowSeconds),
          },
        }
      )
    }

    return null
  } catch (error: any) {
    // Jika ada error di rate limiting, skip rate limiting (fail open)
    console.error('Rate limit error:', error)
    return null
  }
}

/**
 * Rate Limit untuk API Endpoints berdasarkan path
 */
export const apiRateLimitConfig: Record<string, RateLimitOptions> = {
  // Default rate limit untuk semua API
  default: {
    maxRequests: 100,
    windowSeconds: 60, // 100 requests per minute
  },
  // Rate limit khusus untuk endpoint yang lebih sensitif
  '/api/auth': {
    maxRequests: 10,
    windowSeconds: 60, // 10 requests per minute
  },
  '/api/olts/test-connection': {
    maxRequests: 20,
    windowSeconds: 60, // 20 requests per minute
  },
  '/api/mikrotik-routers/test-connection': {
    maxRequests: 20,
    windowSeconds: 60, // 20 requests per minute
  },
  '/api/kmz': {
    maxRequests: 10,
    windowSeconds: 60, // 10 uploads per minute
  },
}

/**
 * Helper untuk mendapatkan rate limit config berdasarkan path
 */
export function getRateLimitConfig(pathname: string): RateLimitOptions {
  if (!pathname || typeof pathname !== 'string') {
    return apiRateLimitConfig.default
  }

  // Cek exact match dulu
  if (apiRateLimitConfig[pathname]) {
    return apiRateLimitConfig[pathname]
  }

  // Cek prefix match
  for (const [prefix, config] of Object.entries(apiRateLimitConfig)) {
    if (prefix !== 'default' && pathname.startsWith(prefix)) {
      return config
    }
  }

  // Return default
  return apiRateLimitConfig.default
}

