import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getRateLimitConfig, rateLimit } from '@/lib/middleware/rate-limit'
import { getSubdomain, isAdminSubdomain, isPelangganSubdomain, isKaryawanSubdomain, isFinanceSubdomain } from '@/lib/utils/subdomain'

// Create auth middleware dengan callback URL yang menjaga subdomain
const authMiddleware = withAuth({
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ token, req }) {
      // Middleware sudah handle auth check, jadi return true jika token ada
      return !!token
    },
  },
})

// Combine auth middleware dengan rate limiting
export default async function middleware(request: NextRequest) {
  try {
    const pathname = request.nextUrl?.pathname || ''
    const subdomain = getSubdomain(request)

    // Subdomain-based routing
    // Jika request dari admin subdomain, redirect ke /admin
    if (isAdminSubdomain(request)) {
      // Jika pathname tidak dimulai dengan /admin, redirect ke /admin
      if (!pathname.startsWith('/admin') && !pathname.startsWith('/api') && !pathname.startsWith('/login')) {
        const url = request.nextUrl.clone()
        url.pathname = '/admin'
        return NextResponse.redirect(url)
      }
    }

    // Jika request dari pelanggan subdomain, redirect ke /pelanggan
    if (isPelangganSubdomain(request)) {
      // Jika pathname tidak dimulai dengan /pelanggan, redirect ke /pelanggan
      if (!pathname.startsWith('/pelanggan') && !pathname.startsWith('/api') && !pathname.startsWith('/login')) {
        const url = request.nextUrl.clone()
        url.pathname = '/pelanggan'
        return NextResponse.redirect(url)
      }
    }

    // Jika request dari karyawan subdomain, redirect ke /employee
    if (isKaryawanSubdomain(request)) {
      // Jika pathname tidak dimulai dengan /employee, redirect ke /employee
      if (!pathname.startsWith('/employee') && !pathname.startsWith('/api') && !pathname.startsWith('/login')) {
        const url = request.nextUrl.clone()
        url.pathname = '/employee'
        return NextResponse.redirect(url)
      }
    }

    // Jika request dari finance subdomain, redirect ke /finance
    if (isFinanceSubdomain(request)) {
      // Jika pathname tidak dimulai dengan /finance, redirect ke /finance
      if (!pathname.startsWith('/finance') && !pathname.startsWith('/api') && !pathname.startsWith('/login')) {
        const url = request.nextUrl.clone()
        url.pathname = '/finance'
        return NextResponse.redirect(url)
      }
    }

    // Jika tidak ada subdomain tapi mengakses /admin, /pelanggan, /employee atau /finance
    // Redirect ke subdomain yang sesuai (untuk production)
    // Di development, kita biarkan tetap bisa akses langsung
    if (!subdomain) {
      if (pathname.startsWith('/admin')) {
        // Di development, biarkan tetap bisa akses
        // Di production, bisa redirect ke admin subdomain jika diperlukan
        // const url = request.nextUrl.clone()
        // url.hostname = `admin.${url.hostname}`
        // return NextResponse.redirect(url)
      }
      if (pathname.startsWith('/pelanggan')) {
        // Di development, biarkan tetap bisa akses
        // Di production, bisa redirect ke pelanggan subdomain jika diperlukan
        // const url = request.nextUrl.clone()
        // url.hostname = `pelanggan.${url.hostname}`
        // return NextResponse.redirect(url)
      }
      if (pathname.startsWith('/employee')) {
        // Di development, biarkan tetap bisa akses
        // Di production, bisa redirect ke karyawan subdomain jika diperlukan
        // const url = request.nextUrl.clone()
        // url.hostname = `karyawan.${url.hostname}`
        // return NextResponse.redirect(url)
      }
      if (pathname.startsWith('/finance')) {
        // Di development, biarkan tetap bisa akses
        // Di production, bisa redirect ke finance subdomain jika diperlukan
        // const url = request.nextUrl.clone()
        // url.hostname = `finance.${url.hostname}`
        // return NextResponse.redirect(url)
      }
    }

    // Rate limiting untuk API routes
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

    // Auth middleware untuk admin routes (baik dari subdomain atau path)
    if (pathname.startsWith('/admin') || isAdminSubdomain(request)) {
      const response = await authMiddleware(request as any, {} as any)

      // Jika redirect ke login, pastikan redirect URL menjaga subdomain
      if (response && response.status === 307) {
        const loginUrl = response.headers.get('location')
        if (loginUrl && isAdminSubdomain(request)) {
          // Jika sudah di admin subdomain, pastikan login URL juga di admin subdomain
          const url = request.nextUrl.clone()
          url.pathname = '/login'
          if (pathname !== '/admin') {
            url.searchParams.set('callbackUrl', pathname)
          }
          return NextResponse.redirect(url)
        }
      }

      return response
    }

    // Auth middleware untuk employee routes (baik dari subdomain atau path)
    if (pathname.startsWith('/employee') || isKaryawanSubdomain(request)) {
      // Skip auth check untuk login page
      if (pathname === '/employee/login' || pathname === '/login') {
        return NextResponse.next({ request })
      }

      const response = await authMiddleware(request as any, {} as any)

      // Jika redirect ke login, redirect ke employee login page
      if (response && response.status === 307) {
        const url = request.nextUrl.clone()
        url.pathname = '/employee/login'
        if (pathname !== '/employee') {
          url.searchParams.set('callbackUrl', pathname)
        }
        return NextResponse.redirect(url)
      }

      return response
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
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - sw.js (service worker)
     * - manifest.json (PWA manifest)
     */
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
  // Gunakan Node.js runtime untuk kompatibilitas dengan ioredis
  runtime: 'nodejs',
}
