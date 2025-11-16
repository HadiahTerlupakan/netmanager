import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getRateLimitConfig, rateLimit } from '@/lib/middleware/rate-limit'

// Create auth middleware
const authMiddleware = withAuth({
  pages: {
    signIn: '/login',
  },
})

// Combine auth middleware dengan rate limiting
export default async function middleware(request: NextRequest) {
  try {
    // Rate limiting untuk API routes
    const pathname = request.nextUrl?.pathname || ''
    if (pathname.startsWith('/api/')) {
      const config = getRateLimitConfig(pathname)
      const rateLimitResponse = await rateLimit(request, {
        ...config,
        keyGenerator: (req) => {
          // Gunakan IP address atau user ID jika sudah authenticated
          const reqPathname = req.nextUrl?.pathname || 'unknown'
          const forwardedFor = req.headers.get('x-forwarded-for')
          const realIp = req.headers.get('x-real-ip')
          
        let ip = 'unknown'
        if (forwardedFor) {
          const ips = String(forwardedFor).split(',')
          ip = ips[0]?.trim() || 'unknown'
        } else if (realIp) {
          ip = String(realIp).trim() || 'unknown'
        }
          
          return `ratelimit:api:${reqPathname}:${ip}`
        },
      })

      if (rateLimitResponse) {
        return rateLimitResponse
      }
    }

    // Auth middleware untuk admin routes
    if (pathname.startsWith('/admin')) {
      return authMiddleware(request as any, {} as any)
    }

    return NextResponse.next({ request })
  } catch (error: any) {
    // Fallback jika ada error di middleware
    console.error('Middleware error:', error)
    return NextResponse.next({ request })
  }
}

export const config = { 
  matcher: [
    '/admin/:path*',
    '/api/:path*',
  ],
  // Gunakan Node.js runtime untuk kompatibilitas dengan ioredis
  runtime: 'nodejs',
}


