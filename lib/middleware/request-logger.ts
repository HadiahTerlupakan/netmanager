import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

/**
 * Request/Response Logging Middleware
 * 
 * Auto-logging untuk semua API requests dan responses
 * Mencatat: method, path, headers, status, duration, errors
 */

export interface RequestLogOptions {
  logRequestBody?: boolean
  logResponseBody?: boolean
  logHeaders?: boolean
  excludePaths?: string[]
  maxBodyLength?: number
}

const defaultOptions: Required<RequestLogOptions> = {
  logRequestBody: false, // Jangan log body secara default (privacy)
  logResponseBody: false, // Jangan log body secara default (privacy)
  logHeaders: false, // Jangan log headers secara default (privacy)
  excludePaths: ['/api/health'], // Exclude health check dari logging
  maxBodyLength: 1000, // Max length untuk body logging
}

/**
 * Log request details (internal function)
 */
function logRequestInternal(
  req: NextRequest,
  options: RequestLogOptions = {}
): void {
  const opts = { ...defaultOptions, ...options }
  const pathname = req.nextUrl?.pathname || 'unknown'

  // Skip logging untuk excluded paths
  if (opts.excludePaths.some((path) => pathname.startsWith(path))) {
    return
  }

  const method = req.method || 'UNKNOWN'
  const url = req.nextUrl?.href || 'unknown'
  const ip = req.ip || 
             req.headers.get('x-forwarded-for')?.split(',')[0] || 
             req.headers.get('x-real-ip') || 
             'unknown'

  const logContext: Record<string, any> = {
    method,
    path: pathname,
    url,
    ip,
  }

  // Log headers jika diminta
  if (opts.logHeaders) {
    const headers: Record<string, string> = {}
    req.headers.forEach((value, key) => {
      headers[key] = value
    })
    logContext.headers = headers
  }

  // Log request body jika diminta
  if (opts.logRequestBody && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    // Note: Body sudah dibaca di handler, jadi kita tidak bisa read lagi di sini
    // Ini hanya untuk reference, body logging harus dilakukan di handler
  }

  logger.info(`→ ${method} ${pathname}`, logContext)
}

/**
 * Log response details (internal function)
 */
function logResponseInternal(
  req: NextRequest,
  res: NextResponse,
  duration: number,
  options: RequestLogOptions = {}
): void {
  const opts = { ...defaultOptions, ...options }
  const pathname = req.nextUrl?.pathname || 'unknown'

  // Skip logging untuk excluded paths
  if (opts.excludePaths.some((path) => pathname.startsWith(path))) {
    return
  }

  const method = req.method || 'UNKNOWN'
  const status = res.status || 200

  const logContext: Record<string, any> = {
    method,
    path: pathname,
    status,
    duration: `${duration}ms`,
  }

  // Log response headers jika diminta
  if (opts.logHeaders) {
    const headers: Record<string, string> = {}
    res.headers.forEach((value, key) => {
      headers[key] = value
    })
    logContext.responseHeaders = headers
  }

  // Log berdasarkan status code
  if (status >= 500) {
    logger.error(`← ${method} ${pathname} ${status}`, undefined, logContext)
  } else if (status >= 400) {
    logger.warn(`← ${method} ${pathname} ${status}`, logContext)
  } else {
    logger.info(`← ${method} ${pathname} ${status}`, logContext)
  }
}

/**
 * Request Logger Middleware
 * 
 * Usage di API route:
 * ```ts
 * export async function GET(req: NextRequest) {
 *   const startTime = Date.now()
 *   logRequest(req)
 *   
 *   // ... your handler logic
 *   
 *   const response = NextResponse.json({ data: '...' })
 *   logResponse(req, response, Date.now() - startTime)
 *   return response
 * }
 * ```
 */
export function logRequest(req: NextRequest, options?: RequestLogOptions): void {
  logRequestInternal(req, options)
}

export function logResponse(
  req: NextRequest,
  res: NextResponse,
  duration: number,
  options?: RequestLogOptions
): void {
  logResponseInternal(req, res, duration, options)
}

/**
 * Helper untuk wrap API handler dengan auto-logging
 * 
 * Usage:
 * ```ts
 * export const GET = withRequestLogging(async (req: NextRequest) => {
 *   // ... your handler
 *   return NextResponse.json({ data: '...' })
 * })
 * ```
 */
export function withRequestLogging(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options?: RequestLogOptions
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now()
    
    try {
      // Log request
      logRequestInternal(req, options)
      
      // Execute handler
      const response = await handler(req)
      
      // Log response
      logResponseInternal(req, response, Date.now() - startTime, options)
      
      return response
    } catch (error: any) {
      // Log error
      const duration = Date.now() - startTime
      const pathname = req.nextUrl?.pathname || 'unknown'
      const method = req.method || 'UNKNOWN'
      
      logger.error(
        `✗ ${method} ${pathname} ERROR`,
        error,
        {
          method,
          path: pathname,
          duration: `${duration}ms`,
        }
      )
      
      // Return error response
      const errorResponse = NextResponse.json(
        { error: error.message || 'Internal server error' },
        { status: 500 }
      )
      
      logResponseInternal(req, errorResponse, duration, options)
      return errorResponse
    }
  }
}

/**
 * Helper untuk log request body (harus dipanggil sebelum body dibaca)
 * 
 * Usage:
 * ```ts
 * const body = await req.json()
 * logRequestBody(req, body)
 * ```
 */
export function logRequestBody(
  req: NextRequest,
  body: any,
  options?: RequestLogOptions
): void {
  const opts = { ...defaultOptions, ...options }
  
  if (!opts.logRequestBody) {
    return
  }

  const pathname = req.nextUrl?.pathname || 'unknown'
  const method = req.method || 'UNKNOWN'
  
  let bodyStr = ''
  try {
    bodyStr = typeof body === 'string' 
      ? body 
      : JSON.stringify(body)
    
    // Truncate jika terlalu panjang
    if (bodyStr.length > opts.maxBodyLength) {
      bodyStr = bodyStr.substring(0, opts.maxBodyLength) + '... (truncated)'
    }
  } catch (e) {
    bodyStr = '[Unable to stringify body]'
  }

  logger.debug(`Request body for ${method} ${pathname}`, {
    method,
    path: pathname,
    body: bodyStr,
  })
}

/**
 * Helper untuk log response body
 * 
 * Usage:
 * ```ts
 * const response = NextResponse.json({ data: '...' })
 * logResponseBody(req, response, { data: '...' })
 * ```
 */
export function logResponseBody(
  req: NextRequest,
  res: NextResponse,
  body: any,
  options?: RequestLogOptions
): void {
  const opts = { ...defaultOptions, ...options }
  
  if (!opts.logResponseBody) {
    return
  }

  const pathname = req.nextUrl?.pathname || 'unknown'
  const method = req.method || 'UNKNOWN'
  
  let bodyStr = ''
  try {
    bodyStr = typeof body === 'string' 
      ? body 
      : JSON.stringify(body)
    
    // Truncate jika terlalu panjang
    if (bodyStr.length > opts.maxBodyLength) {
      bodyStr = bodyStr.substring(0, opts.maxBodyLength) + '... (truncated)'
    }
  } catch (e) {
    bodyStr = '[Unable to stringify body]'
  }

  logger.debug(`Response body for ${method} ${pathname}`, {
    method,
    path: pathname,
    status: res.status,
    body: bodyStr,
  })
}

