/**
 * Unified API Route Handler
 *
 * This module provides a unified wrapper for API routes that handles:
 * - Authentication (NextAuth session)
 * - Authorization (RBAC permissions via existing authorize middleware)
 * - Request validation (Zod schemas)
 * - Error handling
 * - Standard response format
 *
 * NOTE: For routes that need complex auth (site restriction, etc.),
 * continue using the existing `authorize` middleware from `@/lib/authorization-middleware`.
 * This handler is for simpler cases or new routes.
 *
 * @example
 * // Simple authenticated route
 * import { createHandler, apiSuccess } from '@/lib/api'
 *
 * export const GET = createHandler({
 *   auth: true,
 * }, async (req, ctx) => {
 *   return apiSuccess({ userId: ctx.session?.user.id })
 * })
 *
 * // With validation
 * import { z } from 'zod'
 * const schema = z.object({ name: z.string() })
 *
 * export const POST = createHandler({
 *   auth: true,
 *   schema,
 * }, async (req, ctx) => {
 *   return apiSuccess({ created: ctx.validated.name })
 * })
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import type { ZodSchema, ZodError } from 'zod'
import { authOptions, getUserPermissions } from '@/lib/auth'
import { apiError, ApiErrors, ErrorCodes } from '@/lib/api-response'
import type { ErrorResponse } from '@/lib/api-response'
import { isPrismaRecordNotFoundError } from '@/lib/prisma-errors'
import { parseQuery } from './query-parser'
import { logRequest, logResponse, logAuditActivity } from '@/lib/middleware/request-logger'

// Types
export interface HandlerContext<T = unknown> {
    /** Validated request body (if schema provided) */
    validated: T
    /** Query parameters as object */
    query: Record<string, string | string[]>
    /** Route parameters (from [id] segments) */
    params: Record<string, string>
    /** Authenticated user session */
    session: {
        user: {
            id: string
            email: string
            name?: string
            role?: string
            tenantId?: string
            siteId?: string
            isSuperAdmin?: boolean
        }
    } | null
    /** User permissions (if auth enabled) */
    permissions: string[]
}

export interface HandlerOptions<T = unknown> {
    /** Require authentication */
    auth?: boolean
    /** Required permissions (RBAC) */
    permissions?: string[]
    /** Zod schema for request body validation */
    schema?: ZodSchema<T>
    /** Custom rate limit (requests per minute) */
    rateLimit?: number
}

type RouteHandler<T> = (
    request: NextRequest,
    context: HandlerContext<T>
) => Promise<NextResponse>

/**
 * Creates a standardized API route handler with built-in:
 * - Authentication
 * - Permission checking
 * - Request validation
 * - Error handling
 */
export function createHandler<T = unknown>(
    options: HandlerOptions<T>,
    handler: RouteHandler<T>
) {
    return async (
        request: NextRequest,
        routeContext: { params: Promise<Record<string, string>> }
    ): Promise<NextResponse> => {
        const startTime = Date.now()
        // Resolve params if it's a Promise (Next.js 15+)
        const params = await routeContext.params

        try {
            // Log request
            logRequest(request)

            // Create context object
            const ctx: HandlerContext<T> = {
                validated: {} as T,
                query: parseQuery(request.nextUrl.searchParams),
                params,
                session: null,
                permissions: [],
            }

            // 1. Authentication check
            if (options.auth) {
                const session = await getServerSession(authOptions)

                if (session?.user) {
                    ctx.session = {
                        user: {
                            id: session.user.id || '',
                            email: session.user.email || '',
                            name: session.user.name,
                            role: session.user.role,
                            tenantId: session.user.tenantId,
                            siteId: (session.user as { siteId?: string }).siteId,
                            isSuperAdmin: session.user.isSuperAdmin,
                        }
                    }

                    // Load permissions from session or cache
                    const userPermissions = (session.user as { permissions?: string[] }).permissions
                    if (userPermissions && Array.isArray(userPermissions)) {
                        ctx.permissions = userPermissions
                    } else {
                        // Fallback: Fetch permissions at runtime
                        ctx.permissions = await getUserPermissions(ctx.session!.user.id)
                    }
                } else {
                    // Fallback to Bearer token (Mobile Auth)
                    const authHeader = request.headers.get('Authorization')
                    if (authHeader?.startsWith('Bearer ')) {
                        const token = authHeader.split(' ')[1]
                        if (token) {
                            const { verifyMobileToken } = await import('@/lib/mobile-auth')
                            const payload = await verifyMobileToken(token)

                            if (payload) {
                                ctx.session = {
                                    user: {
                                        id: payload.userId,
                                        email: (payload.email as string) || '',
                                        name: payload.name as string | undefined,
                                        role: payload.role,
                                        tenantId: payload.tenantId,
                                        isSuperAdmin: payload.isSuperAdmin,
                                    }
                                }
                                ctx.permissions = payload.permissions || []
                            }
                        }
                    }
                }

                if (!ctx.session?.user) {
                    return ApiErrors.unauthorized('Session tidak valid atau Token kedaluwarsa')
                }
            }

            // 2. Permission check (RBAC)
            if (options.permissions && options.permissions.length > 0) {
                const hasPermission = options.permissions.some(
                    perm => ctx.permissions.includes(perm) || ctx.permissions.includes('*')
                )

                if (!hasPermission) {
                    const missingPerms = options.permissions.join(', ')
                    return ApiErrors.forbidden(`Akses ditolak. Anda memerlukan permission: ${missingPerms}`)
                }
            }

            // 3. Request body validation
            if (options.schema) {
                const contentType = request.headers.get('content-type') || ''

                if (contentType.includes('application/json')) {
                    try {
                        const body = await request.json()
                        const result = options.schema.safeParse(body)

                        if (!result.success) {
                            return formatValidationError(result.error)
                        }

                        ctx.validated = result.data
                    } catch (e) {
                        console.error("[API Middleware] JSON Parsing/Validation Error:", e)
                        return apiError(
                            'Invalid JSON body',
                            ErrorCodes.VALIDATION_ERROR,
                            { status: 400 }
                        )
                    }
                }
            }

            // 4. Execute handler
            const response = await handler(request, ctx)

            // 5. Automatic logging & audit
            const duration = Date.now() - startTime
            logResponse(request, response, duration)

            // Audit write operations asynchronously (fire-and-forget)
            logAuditActivity(
                request,
                response,
                ctx.session?.user?.id,
                ctx.session?.user?.tenantId,
                ctx.validated // Use validated body for audit log
            ).catch(err => console.error('[Audit Log Fire-and-Forget Error]', err))

            return response

        } catch (error) {
            // 5. Error handling with Sentry
            return handleError(error, request)
        }
    }
}

/**
 * Format Zod validation error to standard response
 */
function formatValidationError(error: ZodError): NextResponse<ErrorResponse> {
    const details: Record<string, string> = {}

    for (const issue of error.issues) {
        const path = issue.path.join('.') || 'general'
        details[path] = issue.message
    }

    return apiError(
        'Validasi gagal',
        ErrorCodes.VALIDATION_ERROR,
        { status: 400, details }
    )
}

/**
 * Centralized error handler
 */
function handleError(error: unknown, request: NextRequest): NextResponse<ErrorResponse> {
    // Log to console
    console.error('[API Error]', {
        url: request.nextUrl.pathname,
        method: request.method,
        error,
    })

    if (isPrismaRecordNotFoundError(error) || (error && typeof error === 'object' && 'code' in error && error.code === 'P2025')) {
        return ApiErrors.notFound('Data tidak ditemukan')
    }

    // Handle known error types
    const message = (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') 
        ? error.message 
        : ''
    
    if (typeof message === 'string') {
        // Business logic errors (Standard prefixes)
        if (message.startsWith('NOT_FOUND:')) {
            return ApiErrors.notFound(message.replace('NOT_FOUND:', ''))
        }
        if (message.startsWith('CONFLICT:')) {
            return ApiErrors.conflict(message.replace('CONFLICT:', ''))
        }
        if (message.startsWith('FORBIDDEN:')) {
            return ApiErrors.forbidden(message.replace('FORBIDDEN:', ''))
        }

        // Common raw business error messages
        if (message === 'Versi tidak ditemukan') {
            return ApiErrors.notFound('Versi aplikasi')
        }

        // Prisma errors
        if (message.includes('Unique constraint')) {
            // Extract field name if possible from Prisma error message
            // Prisma P2002 error usually contains field names in meta
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const target = (error as any).meta?.target
            const field = Array.isArray(target) ? target[target.length - 1] : target
            
            const fieldName = field ? ` (${field})` : ''
            return ApiErrors.conflict(`Data sudah ada${fieldName}. Silakan gunakan nilai lain.`)
        }
        if (message.includes('Record to update not found') || message.includes('No record was found for a delete')) {
            return ApiErrors.notFound('Data tidak ditemukan')
        }
    }

    // Default internal error
    return ApiErrors.internalError('Terjadi kesalahan pada server')
}

// Re-export api response helpers for convenience
export { apiSuccess, apiError, apiPaginated, ApiErrors, ErrorCodes } from '@/lib/api-response'
