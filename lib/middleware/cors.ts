import { NextRequest, NextResponse } from 'next/server'
// import { randomBytes } from 'crypto' // Removed for Edge Runtime compatibility

/**
 * CORS Configuration
 * 
 * Mengatur CORS headers untuk API routes
 */

export interface CorsOptions {
  origin?: string | string[] | ((origin: string | null) => boolean)
  methods?: string[]
  allowedHeaders?: string[]
  exposedHeaders?: string[]
  credentials?: boolean
  maxAge?: number
}

const defaultOptions: Required<Omit<CorsOptions, 'origin'>> & { origin: CorsOptions['origin'] } = {
  origin: getAllowedOrigins(),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Finance-Token', 'X-Client-Version'],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  credentials: false,
  maxAge: 7200, // 2 hours (reduced from 24 hours for security)
}

/**
 * Get allowed origins based on environment
 */
function getAllowedOrigins(): CorsOptions['origin'] {
  const corsOrigin = process.env.CORS_ORIGIN
  const nodeEnv = process.env.NODE_ENV as string

  // Production: require explicit origins but allow mobile/local access
  if (nodeEnv === 'production') {
    return (origin: string | null) => {
      // Allow requests with no origin (e.g. mobile apps, server-to-server)
      if (!origin || origin === 'null') return true

      // Official domains
      const allowedDomains = [
        'https://radpro.id',
        'https://admin.radpro.id',
        'https://finance.radpro.id',
        'https://pelanggan.radpro.id',
        'https://karyawan.radpro.id'
      ]
      
      if (allowedDomains.includes(origin)) return true

      // Allow localhost/127.0.0.1 for mobile app debugging/webview
      // Mobile apps often run on localhost key in WebView
      if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || origin.startsWith('capacitor://')) {
        return true
      }
      
      // Check env var override
      if (corsOrigin) {
        const origins = corsOrigin.split(',').map(o => o.trim())
        if (origins.includes(origin)) return true
      }

      return false
    }
  }
  // Development: allow localhost with port restrictions
  if (nodeEnv === 'development') {
    return (origin: string | null) => {
      if (!origin) return false

      const allowedDevelopmentOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://localhost:8000',
        'http://127.0.0.1:8000'
      ]

      // Allow valid development origins including subdomains
      if (allowedDevelopmentOrigins.includes(origin)) return true

      // Check for localhost with port
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return true

      // Check for subdomains of localhost (e.g., http://karyawan.localhost:3000)
      if (/^http:\/\/[a-z0-9-]+\.localhost(:\d+)?$/.test(origin)) return true

      return false
    }
  }

  // Staging: moderate restrictions
  if (nodeEnv === 'staging') {
    return [
      'https://staging.radpro.id',
      'https://admin-staging.radpro.id'
    ]
  }

  // Fallback: no wildcard for security
  return []
}

/**
 * Check if origin is allowed
 */
function isOriginAllowed(
  origin: string | null,
  allowedOrigin: CorsOptions['origin']
): boolean {
  if (!origin) {
    return false
  }

  if (typeof allowedOrigin === 'string') {
    return allowedOrigin === '*' || allowedOrigin === origin
  }

  if (Array.isArray(allowedOrigin)) {
    return allowedOrigin.includes(origin)
  }

  if (typeof allowedOrigin === 'function') {
    return allowedOrigin(origin)
  }

  return false
}

/**
 * CORS Middleware untuk API routes
 * 
 * Usage:
 * ```ts
 * export async function GET(req: NextRequest) {
 *   const corsResponse = handleCors(req, {
 *     origin: ['http://localhost:3000', 'https://example.com'],
 *     credentials: true,
 *   })
 *   if (corsResponse) return corsResponse
 *   
 *   // ... rest of your handler
 * }
 * ```
 */
export function handleCors(
  req: NextRequest,
  options: CorsOptions = {}
): NextResponse | null {
  const opts = { ...defaultOptions, ...options }
  const origin = req.headers.get('origin')

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    const headers = new Headers()

    // Set Access-Control-Allow-Origin
    if (opts.origin === '*' || (origin && isOriginAllowed(origin, opts.origin))) {
      headers.set('Access-Control-Allow-Origin', origin || '*')
    }

    // Set Access-Control-Allow-Methods
    if (opts.methods && opts.methods.length > 0) {
      headers.set('Access-Control-Allow-Methods', opts.methods.join(', '))
    }

    // Set Access-Control-Allow-Headers
    if (opts.allowedHeaders && opts.allowedHeaders.length > 0) {
      headers.set('Access-Control-Allow-Headers', opts.allowedHeaders.join(', '))
    }

    // Set Access-Control-Expose-Headers
    if (opts.exposedHeaders && opts.exposedHeaders.length > 0) {
      headers.set('Access-Control-Expose-Headers', opts.exposedHeaders.join(', '))
    }

    // Set Access-Control-Allow-Credentials
    if (opts.credentials) {
      headers.set('Access-Control-Allow-Credentials', 'true')
    }

    // Set Access-Control-Max-Age
    if (opts.maxAge) {
      headers.set('Access-Control-Max-Age', String(opts.maxAge))
    }

    return new NextResponse(null, { status: 204, headers })
  }

  // For non-OPTIONS requests, return null to continue
  return null
}

/**
 * Add CORS headers to response
 */
export function addCorsHeaders(
  res: NextResponse,
  req: NextRequest,
  options: CorsOptions = {}
): NextResponse {
  const opts = { ...defaultOptions, ...options }
  const origin = req.headers.get('origin')

  // Set Access-Control-Allow-Origin
  if (opts.origin === '*' || (origin && isOriginAllowed(origin, opts.origin))) {
    res.headers.set('Access-Control-Allow-Origin', origin || '*')
  }

  // Set Access-Control-Allow-Credentials
  if (opts.credentials) {
    res.headers.set('Access-Control-Allow-Credentials', 'true')
  }

  // Set Access-Control-Expose-Headers
  if (opts.exposedHeaders && opts.exposedHeaders.length > 0) {
    res.headers.set('Access-Control-Expose-Headers', opts.exposedHeaders.join(', '))
  }

  // Add additional security headers
  return addSecurityHeaders(res, req)
}

/**
 * Add comprehensive security headers
 */
export function addSecurityHeaders(
  res: NextResponse,
  req: NextRequest
): NextResponse {
  const nodeEnv = process.env.NODE_ENV
  const isProduction = nodeEnv === 'production'

  // Content Security Policy
  if (isProduction) {
    res.headers.set('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Keep unsafe-eval for Next.js development
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "media-src 'self'",
      "manifest-src 'self'",
      "worker-src 'self' blob:",
      "frame-src 'none'",
      "child-src 'none'",
    ].join('; '))
  } else {
    // Development CSP - more permissive
    res.headers.set('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' ws: wss: https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; '))
  }

  // Strict Transport Security (HTTPS only)
  if (isProduction && req.url.startsWith('https://')) {
    res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }

  // Frame Protection
  res.headers.set('X-Frame-Options', 'DENY')

  // MIME type sniffing protection
  res.headers.set('X-Content-Type-Options', 'nosniff')

  // XSS Protection
  res.headers.set('X-XSS-Protection', '1; mode=block')

  // Referrer Policy
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Permissions Policy
  res.headers.set('Permissions-Policy', [
    'camera=(self)',
    'microphone=(self)',
    'geolocation=(self)',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()',
    'ambient-light-sensor=()'
  ].join(', '))

  // Remove server information
  res.headers.set('Server', '')

  // Add request ID for tracking
  // Use Web Crypto API compatible with Edge Runtime
  const requestId = crypto.randomUUID()
  res.headers.set('X-Request-ID', requestId)

  return res
}

/**
 * Helper untuk apply CORS di API route
 * 
 * Usage:
 * ```ts
 * export async function GET(req: NextRequest) {
 *   const corsResponse = applyCors(req)
 *   if (corsResponse) return corsResponse
 *   
 *   const response = NextResponse.json({ data: '...' })
 *   return addCorsHeaders(response, req)
 * }
 * ```
 */
export function applyCors(
  req: NextRequest,
  options: CorsOptions = {}
): NextResponse | null {
  return handleCors(req, options)
}

