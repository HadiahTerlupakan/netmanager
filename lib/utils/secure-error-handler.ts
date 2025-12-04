import { NextResponse } from 'next/server'
import crypto from 'crypto'

// Error types for better classification
export enum ErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  AUTHENTICATION = 'AUTHENTICATION_ERROR',
  AUTHORIZATION = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT_ERROR',
  RATE_LIMIT = 'RATE_LIMIT_ERROR',
  DATABASE = 'DATABASE_ERROR',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE_ERROR',
  SYSTEM = 'SYSTEM_ERROR',
  MALICIOUS_REQUEST = 'MALICIOUS_REQUEST'
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

// Error response interface
export interface SecureErrorResponse {
  error: string
  code?: string
  requestId?: string
  timestamp?: string
  details?: Record<string, any>
}

// Error log entry for internal monitoring
export interface ErrorLogEntry {
  requestId: string
  type: ErrorType
  severity: ErrorSeverity
  message: string
  originalError?: any
  context: {
    method?: string
    url?: string
    ip?: string
    userAgent?: string
    userId?: string
    [key: string]: any
  }
  timestamp: string
}

/**
 * Creates a secure error response that doesn't leak sensitive information
 */
export function createSecureError(
  type: ErrorType,
  userMessage?: string,
  details?: Record<string, any>
): NextResponse {
  const requestId = crypto.randomUUID()
  const timestamp = new Date().toISOString()

  // User-friendly messages based on error type
  const messages: Record<ErrorType, string> = {
    [ErrorType.VALIDATION]: 'Invalid request data',
    [ErrorType.AUTHENTICATION]: 'Authentication required',
    [ErrorType.AUTHORIZATION]: 'Access denied',
    [ErrorType.NOT_FOUND]: 'Resource not found',
    [ErrorType.CONFLICT]: 'Resource conflict',
    [ErrorType.RATE_LIMIT]: 'Too many requests. Please try again later.',
    [ErrorType.DATABASE]: 'Service temporarily unavailable',
    [ErrorType.EXTERNAL_SERVICE]: 'External service unavailable',
    [ErrorType.SYSTEM]: 'Service temporarily unavailable',
    [ErrorType.MALICIOUS_REQUEST]: 'Invalid request'
  }

  // HTTP status codes based on error type
  const statusCodes: Record<ErrorType, number> = {
    [ErrorType.VALIDATION]: 400,
    [ErrorType.AUTHENTICATION]: 401,
    [ErrorType.AUTHORIZATION]: 403,
    [ErrorType.NOT_FOUND]: 404,
    [ErrorType.CONFLICT]: 409,
    [ErrorType.RATE_LIMIT]: 429,
    [ErrorType.DATABASE]: 503,
    [ErrorType.EXTERNAL_SERVICE]: 502,
    [ErrorType.SYSTEM]: 500,
    [ErrorType.MALICIOUS_REQUEST]: 400
  }

  const message = userMessage || messages[type]
  const statusCode = statusCodes[type]

  const errorResponse: SecureErrorResponse = {
    error: message,
    code: type,
    requestId,
    timestamp
  }

  // Include safe details (non-sensitive)
  if (details && Object.keys(details).length > 0) {
    const safeDetails: Record<string, any> = {}

    // Only include non-sensitive fields
    const allowedFields = ['field', 'limit', 'maxSize', 'allowedTypes', 'retryAfter']
    for (const field of allowedFields) {
      if (details[field] !== undefined) {
        safeDetails[field] = details[field]
      }
    }

    if (Object.keys(safeDetails).length > 0) {
      errorResponse.details = safeDetails
    }
  }

  return NextResponse.json(errorResponse, { status: statusCode })
}

/**
 * Creates a validation error response
 */
export function createValidationError(errors: Array<{ field: string; message: string }>): NextResponse {
  return createSecureError(ErrorType.VALIDATION, 'Validation failed', {
    validationErrors: errors.map(err => ({
      field: err.field,
      // Don't expose detailed validation messages to prevent information leakage
      message: 'Invalid value'
    }))
  })
}

/**
 * Creates an authentication error response
 */
export function createAuthError(message?: string): NextResponse {
  return createSecureError(ErrorType.AUTHENTICATION, message || 'Authentication required')
}

/**
 * Creates an authorization error response
 */
export function createAuthorizationError(message?: string): NextResponse {
  return createSecureError(ErrorType.AUTHORIZATION, message || 'Access denied')
}

/**
 * Creates a rate limit error response
 */
export function createRateLimitError(retryAfter?: number): NextResponse {
  const response = createSecureError(
    ErrorType.RATE_LIMIT,
    'Too many requests. Please try again later.',
    retryAfter ? { retryAfter } : undefined
  )

  if (retryAfter) {
    response.headers.set('Retry-After', retryAfter.toString())
  }

  return response
}

/**
 * Creates a file upload error response
 */
export function createFileUploadError(
  type: 'size' | 'type' | 'malicious',
  details?: { maxSize?: number; allowedTypes?: string[] }
): NextResponse {
  const messages = {
    size: 'File size exceeds maximum allowed limit',
    type: 'File type not allowed',
    malicious: 'Invalid file content'
  }

  return createSecureError(ErrorType.VALIDATION, messages[type], details)
}

/**
 * Logs errors securely for internal monitoring
 */
export function logSecureError(
  type: ErrorType,
  severity: ErrorSeverity,
  originalError: any,
  context: Record<string, any>,
  userMessage?: string
): void {
  const requestId = crypto.randomUUID()

  const logEntry: ErrorLogEntry = {
    requestId,
    type,
    severity,
    message: userMessage || originalError?.message || 'Unknown error',
    originalError: process.env.NODE_ENV === 'development' ? originalError : undefined,
    context: {
      ...context,
      // Sanitize sensitive fields
      password: undefined,
      token: undefined,
      apiKey: undefined,
      secret: undefined,
      // Keep other fields for debugging
      method: context.method,
      url: context.url,
      ip: context.ip,
      userAgent: context.userAgent,
      userId: context.userId
    },
    timestamp: new Date().toISOString()
  }

  // In production, this would log to a secure logging service
  if (severity === ErrorSeverity.CRITICAL || severity === ErrorSeverity.HIGH) {
    console.error('[SECURITY ERROR]', JSON.stringify(logEntry))
  } else {
    console.warn('[ERROR]', JSON.stringify({
      requestId: logEntry.requestId,
      type: logEntry.type,
      severity: logEntry.severity,
      message: logEntry.message,
      timestamp: logEntry.timestamp
    }))
  }
}

/**
 * Handles API route errors securely
 */
export function handleApiError(
  error: any,
  context: Record<string, any>
): NextResponse {
  // Classify the error type
  let type = ErrorType.SYSTEM
  let severity = ErrorSeverity.MEDIUM

  if (error.name === 'ZodError' || error.type === 'validation') {
    type = ErrorType.VALIDATION
    severity = ErrorSeverity.LOW
  } else if (error.code === 'P2002') { // Prisma unique constraint
    type = ErrorType.CONFLICT
    severity = ErrorSeverity.LOW
  } else if (error.code === 'P2025') { // Prisma not found
    type = ErrorType.NOT_FOUND
    severity = ErrorSeverity.LOW
  } else if (error.message?.includes('auth') || error.type === 'authentication') {
    type = ErrorType.AUTHENTICATION
    severity = ErrorSeverity.HIGH
  } else if (error.message?.includes('unauthorized') || error.type === 'authorization') {
    type = ErrorType.AUTHORIZATION
    severity = ErrorSeverity.HIGH
  } else if (error.message?.includes('rate limit') || error.type === 'rate_limit') {
    type = ErrorType.RATE_LIMIT
    severity = ErrorSeverity.MEDIUM
  } else if (error.message?.includes('malicious') || error.type === 'malicious') {
    type = ErrorType.MALICIOUS_REQUEST
    severity = ErrorSeverity.CRITICAL
  }

  // Log the error securely
  logSecureError(type, severity, error, context)

  // Return appropriate error response
  if (type === ErrorType.VALIDATION && error.errors) {
    return createValidationError(error.errors)
  }

  return createSecureError(type)
}

/**
 * Wrapper for API route handlers with secure error handling
 */
export function withSecureErrorHandler<T extends Record<string, any> = {}>(
  handler: (request: Request, context: T) => Promise<NextResponse>
) {
  return async (request: Request, context: T): Promise<NextResponse> => {
    try {
      return await handler(request, context)
    } catch (error) {
      const requestContext = {
        method: request.method,
        url: request.url,
        ip: 'unknown', // Will be extracted in middleware
        userAgent: request.headers.get('user-agent') || undefined,
        ...context
      }

      return handleApiError(error, requestContext)
    }
  }
}

/**
 * Creates a success response with consistent format
 */
// Alias for backward compatibility
export const createSecureErrorResponse = createSecureError;

export function createSuccessResponse<T>(
  data: T,
  message?: string,
  meta?: Record<string, any>
): NextResponse {
  const response = {
    success: true,
    message: message || 'Request completed successfully',
    data,
    meta,
    timestamp: new Date().toISOString()
  }

  return NextResponse.json(response)
}