import { NextRequest, NextResponse } from 'next/server'
// NOTE: checkRateLimit uses ioredis which is NOT compatible with Edge Runtime
// For middleware rate limiting, we need to use a different approach
// For now, we'll skip Redis-based rate limiting in middleware
// import { checkRateLimit } from '@/lib/redis'

export interface RateLimitOptions {
  maxRequests: number
  windowSeconds: number
  keyGenerator?: (req: NextRequest) => string
  message?: string
}

/**
 * Rate Limiting Middleware
 * 
 * NOTE: This function is disabled because it runs in Edge Runtime
 * but ioredis requires Node.js runtime. Rate limiting should be
 * implemented at the API route level instead (which runs in Node.js).
 * 
 * @param options - Konfigurasi rate limiting
 * @returns null (rate limiting disabled in middleware)
 */
export async function rateLimit(
  req: NextRequest,
  options: RateLimitOptions
): Promise<NextResponse | null> {
  // Skip rate limiting in middleware - ioredis is not Edge-compatible
  // Rate limiting should be done at API route level instead
  return null
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
  // Session check - called on every page navigation, needs higher limit
  '/api/auth/session': {
    maxRequests: 200,
    windowSeconds: 60, // 200 requests per minute (high because every page checks session)
  },
  // CSRF token fetch - also called frequently
  '/api/auth/csrf': {
    maxRequests: 200,
    windowSeconds: 60, // 200 requests per minute
  },
  // OAuth providers list - called on login page
  '/api/auth/oauth/providers': {
    maxRequests: 50,
    windowSeconds: 60, // 50 requests per minute
  },
  // Auth callback - rate limit strictly for security
  '/api/auth/callback': {
    maxRequests: 10,
    windowSeconds: 300, // 10 requests per 5 minutes
  },
  // Login attempts - strict rate limit for security
  '/api/auth/signin': {
    maxRequests: 5,
    windowSeconds: 300, // 5 requests per 5 minutes
  },
  // Rate limit untuk general auth (fallback for other auth endpoints)
  '/api/auth': {
    maxRequests: 30,
    windowSeconds: 60, // 30 requests per minute
  },
  '/api/pelanggan/auth/login': {
    maxRequests: 5,
    windowSeconds: 300, // 5 requests per 5 menit
  },
  '/api/pelanggan/auth/refresh': {
    maxRequests: 10,
    windowSeconds: 300, // 10 requests per 5 menit
  },
  '/api/finance/auth/login': {
    maxRequests: 5,
    windowSeconds: 300, // 5 requests per 5 menit
  },
  '/api/olts/test-connection': {
    maxRequests: 10,
    windowSeconds: 60, // 10 requests per minute
  },
  '/api/mikrotik-routers/test-connection': {
    maxRequests: 10,
    windowSeconds: 60, // 10 requests per minute
  },
  '/api/kmz': {
    maxRequests: 5,
    windowSeconds: 60, // 5 uploads per minute
  },
  '/api/pelanggan-ppp': {
    maxRequests: 20,
    windowSeconds: 60, // 20 requests per minute
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

  // Cek prefix match - sort by path length descending to prioritize more specific paths
  // This ensures /api/auth/session matches before /api/auth
  const entries = Object.entries(apiRateLimitConfig)
    .filter(([key]) => key !== 'default')
    .sort((a, b) => b[0].length - a[0].length)

  for (const [prefix, config] of entries) {
    if (pathname.startsWith(prefix)) {
      return config
    }
  }

  // Return default
  return apiRateLimitConfig.default
}

