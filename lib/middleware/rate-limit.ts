/**
 * Rate Limiting Middleware
 * Per-endpoint rate limiting using Redis
 */

import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/redis'
import type { UserSession } from '@/lib/auth'
import type { AuthContext } from './auth'
import { apiError, ErrorCodes } from '@/lib/api-response'

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum number of requests */
  limit: number
  /** Time window in seconds */
  window: number
  /** Custom key prefix (optional) */
  keyPrefix?: string
  /** Skip rate limit for authenticated users (default: false) */
  skipAuthenticated?: boolean
}

/**
 * Middleware to apply rate limiting
 * Works with both authenticated and anonymous requests
 * 
 * @example
 * ```ts
 * // Limit to 10 requests per minute
 * export const POST = withRateLimit(
 *   { limit: 10, window: 60 },
 *   async (request) => {
 *     return apiSuccess({ message: 'Success' })
 *   }
 * )
 * ```
 */
export function withRateLimit<T = any>(
  config: RateLimitConfig,
  handler: (request: any, routeContext?: any) => Promise<NextResponse<T>>
) {
  return async (request: any, routeContext?: any): Promise<NextResponse> => {
    try {
      // Determine rate limit key
      let rateLimitKey: string
      
      // Check if this is an authenticated context
      const isAuthContext = 'user' in request && request.user
      
      if (isAuthContext && config.skipAuthenticated) {
        // Skip rate limiting for authenticated users if configured
        return handler(request, routeContext)
      }
      
      if (isAuthContext) {
        // Use user ID for authenticated requests
        const context = request as AuthContext
        rateLimitKey = `${config.keyPrefix || 'api'}:${context.user.id}`
      } else {
        // Use IP address for anonymous requests
        const req = request.request || request
        const forwarded = req.headers.get('x-forwarded-for')
        const ip = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || 'unknown'
        rateLimitKey = `${config.keyPrefix || 'api'}:${ip}`
      }
      
      // Check rate limit
      const allowed = await checkRateLimit(rateLimitKey, config.limit, config.window)
      
      if (!allowed) {
        return apiError(
          'Too many requests. Please try again later.',
          ErrorCodes.BUSINESS_LOGIC_ERROR,
          { 
            status: 429,
            headers: {
              'Retry-After': config.window.toString()
            }
          }
        )
      }
      
      return handler(request, routeContext)
    } catch (error) {
      console.error('[Rate Limit] Error checking rate limit:', error)
      // Fail open - allow request if rate limiting fails
      return handler(request, routeContext)
    }
  }
}

/**
 * Middleware to apply rate limiting for authenticated requests only
 * Uses user ID as the key
 * 
 * @example
 * ```ts
 * export const POST = withAuth(
 *   withAuthRateLimit({ limit: 100, window: 3600 }, async ({ user }) => {
 *     return apiSuccess(data)
 *   })
 * )
 * ```
 */
export function withAuthRateLimit<T = any>(
  config: Omit<RateLimitConfig, 'skipAuthenticated'>,
  handler: (context: AuthContext, routeContext?: any) => Promise<NextResponse<T>>
) {
  return async (context: AuthContext, routeContext?: any): Promise<NextResponse> => {
    try {
      const rateLimitKey = `${config.keyPrefix || 'api'}:${context.user.id}`
      
      const allowed = await checkRateLimit(rateLimitKey, config.limit, config.window)
      
      if (!allowed) {
        return apiError(
          'Too many requests. Please try again later.',
          ErrorCodes.BUSINESS_LOGIC_ERROR,
          { 
            status: 429,
            headers: {
              'Retry-After': config.window.toString()
            }
          }
        )
      }
      
      return handler(context, routeContext)
    } catch (error) {
      console.error('[Auth Rate Limit] Error checking rate limit:', error)
      // Fail open - allow request if rate limiting fails
      return handler(context, routeContext)
    }
  }
}

/**
 * Predefined rate limit configurations
 */
export const RateLimits = {
  /** Strict: 10 requests per minute */
  STRICT: { limit: 10, window: 60 },
  
  /** Standard: 60 requests per minute */
  STANDARD: { limit: 60, window: 60 },
  
  /** Relaxed: 100 requests per minute */
  RELAXED: { limit: 100, window: 60 },
  
  /** Hourly: 1000 requests per hour */
  HOURLY: { limit: 1000, window: 3600 },
  
  /** Login: 5 attempts per 5 minutes */
  LOGIN: { limit: 5, window: 300, keyPrefix: 'login' },
  
  /** Export: 3 exports per 10 minutes */
  EXPORT: { limit: 3, window: 600, keyPrefix: 'export' },
} as const
