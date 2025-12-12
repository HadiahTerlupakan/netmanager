import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getRateLimitConfig, rateLimit } from '@/lib/middleware/rate-limit'
import { getSubdomain, isAdminSubdomain, isPelangganSubdomain, isKaryawanSubdomain, isFinanceSubdomain, isHelpdeskSubdomain } from '@/lib/utils/subdomain'
import { getToken } from 'next-auth/jwt'
import { ROUTE_PERMISSIONS } from '@/lib/config/route-permissions'

// RBAC Enforcement: Now actually checks permissions from session.permissions
// Permissions are loaded from CustomRole.allowedFeatures during login

// All available permissions (admin + employee portal)
const ALL_PERMISSIONS = [
  'DASHBOARD', 'ROLES', 'NETWORK', 'FTTH', 'PAKET', 'PELANGGAN',
  'INVENTORY', 'USERS', 'HELPDESK', 'WORKORDERS', 'HRIS', 'FINANCE', 'PENGATURAN',
  // Employee Portal
  'EMPLOYEE.DASHBOARD', 'EMPLOYEE.ABSENSI', 'EMPLOYEE.CUTI', 'EMPLOYEE.INVENTORY',
  'EMPLOYEE.WORKORDERS', 'EMPLOYEE.PAYSLIPS', 'EMPLOYEE.PROFILE'
]

// ROUTE_PERMISSIONS is imported from @/lib/config/route-permissions

// Function to get required permission for a route
function getRequiredPermission(pathname: string): string | null {
  // First try exact match from config
  if (ROUTE_PERMISSIONS[pathname]) {
    return ROUTE_PERMISSIONS[pathname]
  }

  // Then try prefix match (longest match wins)
  const sortedRoutes = Object.keys(ROUTE_PERMISSIONS).sort((a, b) => b.length - a.length)
  for (const route of sortedRoutes) {
    if (pathname.startsWith(route)) {
      return ROUTE_PERMISSIONS[route]
    }
  }
  return null
}

// Check if user has permission (with hierarchy and suffix match support)
function hasPermission(userPermissions: string[] | undefined, requiredFeature: string): boolean {
  if (!userPermissions || !Array.isArray(userPermissions)) return false

  // 1. Exact match
  if (userPermissions.includes(requiredFeature)) return true

  // 2. Parent match (e.g. PELANGGAN access grants PELANGGAN.TAGIHAN)
  const parts = requiredFeature.split('.')
  while (parts.length > 1) {
    parts.pop()
    const parent = parts.join('.')
    if (userPermissions.includes(parent)) return true
  }

  // 3. Suffix/Base match - if route needs 'EMPLOYEE.INVENTORY' and user has 'INVENTORY'
  // This allows admin-defined features (INVENTORY) to work for employee portal routes (EMPLOYEE.INVENTORY)
  const baseParts = requiredFeature.split('.')
  if (baseParts.length > 1) {
    const lastPart = baseParts[baseParts.length - 1] // e.g. 'INVENTORY'
    if (userPermissions.includes(lastPart)) return true
  }

  return false
}

// Function to get user permissions from token
// IMPORTANT: Now returns actual permissions from session token
function getUserPermissions(token: any): string[] {
  // Debug log to see what role is in token
  console.log(`[PROXY] getUserPermissions - email: ${token?.email}, role: ${token?.role}, type: ${typeof token?.role}`)

  // For ADMIN users, grant all permissions (fail-safe)
  if (token?.role === 'ADMIN') {
    console.log('[PROXY] ADMIN detected, granting all permissions')
    return ALL_PERMISSIONS
  }

  // Return permissions from session (set during login in auth.ts)
  return token?.permissions || []
}

// NOTE: hasRoutePermission and hasRequiredRole removed - now handled at API/page level

// Log unauthorized access attempts
function logUnauthorizedAccess(request: NextRequest, reason: string) {
  const userAgent = request.headers.get('user-agent') || 'Unknown'
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'Unknown'
  const timestamp = new Date().toISOString()

  console.warn(`[SECURITY] Unauthorized access attempt - ${reason}`, {
    timestamp,
    ip,
    userAgent,
    url: request.url,
    method: request.method,
  })
}

// SIMPLIFIED: Only check authentication, not authorization
// Authorization is handled at API/page level using CustomRole permissions
async function checkRoleAccess(request: NextRequest, pathname: string): Promise<NextResponse | null> {
  // Skip auth check for public routes
  if (pathname.startsWith('/api/auth/') || pathname === '/login' || pathname === '/') {
    return null
  }

  // Only check if route needs authentication (not authorization)
  const needsAuth = pathname.startsWith('/admin') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/employee') ||
    pathname.startsWith('/finance') ||
    pathname.startsWith('/hr')

  if (!needsAuth) {
    return null
  }

  try {
    // Get the token from the request
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
      secureCookie: process.env.NODE_ENV === 'production',
    })

    if (!token) {
      logUnauthorizedAccess(request, 'No authentication token')

      // For API routes, return 401
      if (pathname.startsWith('/api/')) {
        return new NextResponse(
          JSON.stringify({ error: 'Authentication required' }),
          {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
      }

      // For pages, redirect to login
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // User is authenticated - now check authorization
    const userPermissions = getUserPermissions(token)
    const requiredPermission = getRequiredPermission(pathname)

    console.log(`[PROXY] Auth check - Path: ${pathname}, Role: ${token.role}, Required: ${requiredPermission || 'none'}`)

    // If route requires a specific permission, check it
    if (requiredPermission) {
      if (!hasPermission(userPermissions, requiredPermission)) {
        console.log(`[PROXY] Access denied for ${token.email} to ${pathname}. Required: ${requiredPermission}, Has: ${userPermissions.join(', ')}`)

        // For API routes, return 403
        if (pathname.startsWith('/api/')) {
          return new NextResponse(
            JSON.stringify({ error: 'Forbidden', required: requiredPermission }),
            {
              status: 403,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }

        // For pages, redirect to dashboard with access denied message
        const redirectUrl = new URL('/admin', request.url)
        redirectUrl.searchParams.set('accessDenied', 'true')
        redirectUrl.searchParams.set('required', requiredPermission)
        return NextResponse.redirect(redirectUrl)
      }
    }

    // User info is available via session - no need to expose in response headers
    // Note: If reverse proxy (nginx/traefik) needs user info, consider using
    // internal headers with 'X-Internal-' prefix that are stripped at the edge
    return NextResponse.next()

  } catch (error) {
    console.error('[PROXY] Role check error:', error)

    // For API routes, return 500
    if (pathname.startsWith('/api/')) {
      return new NextResponse(
        JSON.stringify({ error: 'Internal server error' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // For pages, redirect to error page
    return NextResponse.redirect(new URL('/error', request.url))
  }
}

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
export default async function proxy(request: NextRequest) {
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

    // Jika request dari helpdesk subdomain, redirect ke /helpdesk
    if (isHelpdeskSubdomain(request)) {
      // Jika pathname tidak dimulai dengan /helpdesk, redirect ke /helpdesk
      if (!pathname.startsWith('/helpdesk') && !pathname.startsWith('/api') && !pathname.startsWith('/login')) {
        const url = request.nextUrl.clone()
        url.pathname = '/helpdesk'
        return NextResponse.redirect(url)
      }
    }

    // Jika tidak ada subdomain tapi mengakses /admin, /pelanggan, /employee atau /finance
    // Redirect ke subdomain yang sesuai
    if (!subdomain) {
      // Redirect root domain login & home ke admin subdomain
      if (pathname === '/' || pathname === '/login') {
        const url = request.nextUrl.clone()
        url.hostname = `admin.${url.hostname}`
        // Jika akses root '/', arahkan ke dashboard admin '/admin' di subdomain admin
        // Jika akses '/login', arahkan ke '/login' di subdomain admin
        if (pathname === '/') {
          url.pathname = '/admin'
        }
        return NextResponse.redirect(url)
      }

      if (pathname.startsWith('/admin')) {
        const url = request.nextUrl.clone()
        url.hostname = `admin.${url.hostname}`
        return NextResponse.redirect(url)
      }
      if (pathname.startsWith('/pelanggan')) {
        const url = request.nextUrl.clone()
        url.hostname = `pelanggan.${url.hostname}`
        return NextResponse.redirect(url)
      }
      if (pathname.startsWith('/employee')) {
        const url = request.nextUrl.clone()
        url.hostname = `karyawan.${url.hostname}`
        return NextResponse.redirect(url)
      }
      if (pathname.startsWith('/finance')) {
        const url = request.nextUrl.clone()
        url.hostname = `finance.${url.hostname}`
        return NextResponse.redirect(url)
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

    // Check role-based access for protected routes
    const roleCheckResponse = await checkRoleAccess(request, pathname)
    if (roleCheckResponse) {
      return roleCheckResponse
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

    // Auth middleware untuk helpdesk routes (baik dari subdomain atau path)
    if (pathname.startsWith('/helpdesk') || isHelpdeskSubdomain(request)) {
      // Skip auth check untuk login page dan access-denied page
      if (pathname === '/helpdesk/login' || pathname === '/helpdesk/access-denied' || pathname === '/login') {
        return NextResponse.next({ request })
      }

      const response = await authMiddleware(request as any, {} as any)

      // Jika redirect ke login, redirect ke helpdesk login page
      if (response && response.status === 307) {
        const url = request.nextUrl.clone()
        url.pathname = '/helpdesk/login'
        if (pathname !== '/helpdesk') {
          url.searchParams.set('callbackUrl', pathname)
        }
        return NextResponse.redirect(url)
      }

      return response
    }

    // Auth middleware untuk finance routes (baik dari subdomain atau path)
    if (pathname.startsWith('/finance') || isFinanceSubdomain(request)) {
      // Skip auth check untuk login page
      if (pathname === '/finance/login' || pathname === '/login') {
        return NextResponse.next({ request })
      }

      const response = await authMiddleware(request as any, {} as any)

      // Jika redirect ke login, redirect ke finance login page
      if (response && response.status === 307) {
        const url = request.nextUrl.clone()
        url.pathname = '/finance/login'
        if (pathname !== '/finance') {
          url.searchParams.set('callbackUrl', pathname)
        }
        return NextResponse.redirect(url)
      }

      return response
    }

    // Add security headers to all responses
    const response = NextResponse.next({ request })
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https:;"
    )

    return response
  } catch (error: any) {
    // FAIL-CLOSE: Security-first approach - block request on proxy error
    console.error('Proxy security error:', error.message)

    // Return error response instead of allowing bypass
    return NextResponse.json(
      {
        error: 'Service temporarily unavailable',
        code: 'PROXY_ERROR'
      },
      {
        status: 503,
        headers: {
          'Retry-After': '60'
        }
      }
    )
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
}