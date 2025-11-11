import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getRateLimitConfig } from './rate-limit'

/**
 * Helper function untuk apply rate limiting di API route handlers
 * 
 * Usage:
 * ```ts
 * export async function POST(req: NextRequest) {
 *   const rateLimitResponse = await applyApiRateLimit(req)
 *   if (rateLimitResponse) return rateLimitResponse
 *   
 *   // ... rest of your handler
 * }
 * ```
 */
export async function applyApiRateLimit(
  req: NextRequest
): Promise<NextResponse | null> {
  try {
    const pathname = req.nextUrl?.pathname || 'unknown'
    const config = getRateLimitConfig(pathname)
    
    return rateLimit(req, {
      ...config,
      keyGenerator: (request) => {
        // Gunakan IP address atau user ID jika sudah authenticated
        const reqPathname = request.nextUrl?.pathname || 'unknown'
        const forwardedFor = request.headers.get('x-forwarded-for')
        const realIp = request.headers.get('x-real-ip')
        
        let ip = request.ip || 'unknown'
        if (!ip || ip === 'unknown') {
          if (forwardedFor) {
            const ips = String(forwardedFor).split(',')
            ip = ips[0]?.trim() || 'unknown'
          } else if (realIp) {
            ip = String(realIp).trim() || 'unknown'
          }
        }
        
        return `ratelimit:api:${reqPathname}:${ip}`
      },
    })
  } catch (error: any) {
    // Fail open - skip rate limiting jika ada error
    console.error('applyApiRateLimit error:', error)
    return null
  }
}

