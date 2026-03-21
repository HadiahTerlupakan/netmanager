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
  /** Enable automatic audit logging to SystemLog for write operations */
  audit?: boolean
}

const defaultOptions: Required<RequestLogOptions> = {
  logRequestBody: false, // Jangan log body secara default (privacy)
  logResponseBody: false, // Jangan log body secara default (privacy)
  logHeaders: false, // Jangan log headers secara default (privacy)
  excludePaths: ['/api/health', '/api/docs'], // Exclude health check dari logging
  maxBodyLength: 1000, // Max length untuk body logging
  audit: false,
}

const SENSITIVE_FIELDS = [
  'password',
  'apiPassword',
  'secret',
  'secretRadius',
  'token',
  'accessToken',
  'refreshToken',
  'clientSecret',
]

/**
 * Redact sensitive fields from an object recursively
 */
function redactSensitiveData(data: unknown): unknown {
  if (!data || typeof data !== 'object') {
    return data
  }

  if (Array.isArray(data)) {
    return data.map(redactSensitiveData)
  }

  const redacted = { ...data as Record<string, unknown> }
  for (const key in redacted) {
    if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      redacted[key] = '[REDACTED]'
    } else if (typeof redacted[key] === 'object') {
      redacted[key] = redactSensitiveData(redacted[key])
    }
  }

  return redacted
}

/**
 * List of paths that require auditing even for GET (READ) operations.
 * Focus on Finance, PII, and sensitive records.
 */
const SENSITIVE_READ_PATHS = [
  '/api/admin/salary',
  '/api/admin/pelanggan',
  '/api/admin/investors',
  '/api/finance',
  '/api/mobile/salary',
  '/api/pelanggan-ppp',
]

/**
 * Log audit activity to SystemLog
 */
export async function logAuditActivity(
  req: NextRequest,
  res: NextResponse,
  userId?: string,
  tenantId?: string,
  body?: unknown
): Promise<void> {
  const method = req.method
  const pathname = req.nextUrl.pathname
  const status = res.status

  // 1. Determine if this request should be audited
  const isWriteOp = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  const isSensitiveRead = method === 'GET' && SENSITIVE_READ_PATHS.some(path => pathname.startsWith(path))

  // Only audit successful write operations or sensitive reads
  if ((!isWriteOp && !isSensitiveRead) || status >= 400) {
    return
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 
             req.headers.get('x-real-ip') || 
             'unknown'
  const userAgent = req.headers.get('user-agent') || 'unknown'

  let action = 'UNKNOWN'
  switch (method) {
    case 'GET': action = 'READ'; break
    case 'POST': action = 'CREATE'; break
    case 'PUT':
    case 'PATCH': action = 'UPDATE'; break
    case 'DELETE': action = 'DELETE'; break
  }

  // Generate subject from path (e.g., /api/mikrotik-routers -> MikroTik Routers)
  const subject = pathname
    .split('/')
    .filter(Boolean)
    .filter(p => p !== 'api' && p !== 'admin')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).replace(/-/g, ' '))
    .join(' ') || 'API Action'

  await logger.logActivity({
    action,
    subject,
    userId,
    tenantId,
    ipAddress: ip,
    userAgent,
    details: body ? redactSensitiveData(body) as Record<string, unknown> : { path: pathname, status }
  }).catch(err => console.error('[Audit Log Error]', err))
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
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 
             req.headers.get('x-real-ip') || 
             'unknown'

  const logContext: Record<string, unknown> = {
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

  const logContext: Record<string, unknown> = {
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
    } catch (error) {
      // Log error
      const duration = Date.now() - startTime
      const pathname = req.nextUrl?.pathname || 'unknown'
      const method = req.method || 'UNKNOWN'

      logger.error(
        `✗ ${method} ${pathname} ERROR`,
        error as Error,
        {
          method,
          path: pathname,
          duration: `${duration}ms`,
        }
      )

      // Return error response
      const errorResponse = NextResponse.json(
        { error: (error as Error).message || 'Internal server error' },
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
  body: unknown,
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
  } catch (_e) {
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
  body: unknown,
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
  } catch (_e) {
    bodyStr = '[Unable to stringify body]'
  }

  logger.debug(`Response body for ${method} ${pathname}`, {
    method,
    path: pathname,
    status: res.status,
    body: bodyStr,
  })
}

