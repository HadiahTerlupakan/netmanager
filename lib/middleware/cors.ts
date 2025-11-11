import { NextRequest, NextResponse } from 'next/server'

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
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: [],
  credentials: false,
  maxAge: 86400, // 24 hours
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

