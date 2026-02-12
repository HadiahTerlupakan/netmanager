/**
 * Error Handler Middleware
 * Provides custom error classes and standardized error handling for API routes
 */

import { NextRequest, NextResponse } from 'next/server'
import { apiError, ErrorCodes } from '@/lib/api-response'

/**
 * Base application error class
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string = ErrorCodes.INTERNAL_ERROR,
    public status: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ErrorCodes.VALIDATION_ERROR, 400, details)
    this.name = 'ValidationError'
  }
}

/**
 * Unauthorized error (401)
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Tidak terautentikasi') {
    super(message, ErrorCodes.UNAUTHORIZED, 401)
    this.name = 'UnauthorizedError'
  }
}

/**
 * Forbidden error (403)
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Akses ditolak') {
    super(message, ErrorCodes.FORBIDDEN, 403)
    this.name = 'ForbiddenError'
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, ErrorCodes.NOT_FOUND, 404)
    this.name = 'NotFoundError'
  }
}

/**
 * Conflict error (409)
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, ErrorCodes.CONFLICT, 409)
    this.name = 'ConflictError'
  }
}

/**
 * Wraps an async API route handler with standardized error handling
 *
 * @example
 * ```ts
 * export const GET = withErrorHandler(async (request: NextRequest) => {
 *   // Your handler logic
 *   if (!data) throw new NotFoundError('Data')
 *   return apiSuccess(data)
 * })
 * ```
 */
export function withErrorHandler<T = unknown>(
  handler: (request: NextRequest, context?: unknown) => Promise<NextResponse<T>>
) {
  return async (request: NextRequest, context?: unknown): Promise<NextResponse> => {
    try {
      return await handler(request, context)
    } catch (error) {
      console.error('[API Error Handler]', error)

      // Handle custom AppError instances
      if (error instanceof AppError) {
        return apiError(error.message, error.code, {
          status: error.status,
          ...(error.details ? { details: error.details } : {})
        })
      }

      // Handle Zod validation errors
      if (error && typeof error === 'object' && 'issues' in error) {
        const zodError = error as { issues: unknown[] }
        console.error('[API Validation Error Details]', JSON.stringify(zodError.issues, null, 2))
        return apiError(
          'Validation failed',
          ErrorCodes.VALIDATION_ERROR,
          {
            status: 400,
            details: { issues: zodError.issues }
          }
        )
      }

      // Handle Prisma errors
      if (error && typeof error === 'object' && 'code' in error) {
        const prismaError = error as { code: string }

        // Unique constraint violation
        if (prismaError.code === 'P2002') {
          return apiError(
            'Data already exists',
            ErrorCodes.ALREADY_EXISTS,
            { status: 409 }
          )
        }

        // Record not found
        if (prismaError.code === 'P2025') {
          return apiError(
            'Record not found',
            ErrorCodes.NOT_FOUND,
            { status: 404 }
          )
        }

        // Generic database error
        return apiError(
          'Database error occurred',
          ErrorCodes.DATABASE_ERROR,
          { status: 500 }
        )
      }

      // Handle standard Error instances
      if (error instanceof Error) {
        return apiError(
          error.message || 'Internal server error',
          ErrorCodes.INTERNAL_ERROR,
          { status: 500 }
        )
      }

      // Handle unknown errors
      return apiError(
        'An unexpected error occurred',
        ErrorCodes.INTERNAL_ERROR,
        { status: 500 }
      )
    }
  }
}
