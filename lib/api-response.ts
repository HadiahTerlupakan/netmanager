/**
 * API Response Utilities
 * Standardizes API response format across the application
 */

import { NextResponse, NextRequest } from 'next/server'

/**
 * Standard success response format
 */
export interface SuccessResponse<T = unknown> {
    success: true
    data: T
    message?: string
}

/**
 * Standard error response format  
 */
export interface ErrorResponse {
    success: false
    error: string
    code: string
    details?: Record<string, unknown>
}

/**
 * Helper to serialize BigInt correctly
 * Converts BigInt to Number if safe, otherwise to String
 */
export function serializeData<T>(data: T): T {
    if (data === null || data === undefined) {
        return data;
    }

    if (typeof data === 'bigint') {
        // Convert to Number if it's within safe integer limits, otherwise string
        return (data <= BigInt(Number.MAX_SAFE_INTEGER) && data >= BigInt(Number.MIN_SAFE_INTEGER) 
            ? Number(data) 
            : data.toString()) as unknown as T;
    }

    if (Array.isArray(data)) {
        return data.map(item => serializeData(item)) as unknown as T;
    }

    if (typeof data === 'object') {
        // Handle Date objects explicitly so they don't become plain objects
        if (data instanceof Date) {
            return data;
        }
        
        const serializedObj: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
            serializedObj[key] = serializeData(value);
        }
        return serializedObj as unknown as T;
    }

    return data;
}

/**
 * Create a standardized success response
 */
export function apiSuccess<T>(
    data: T,
    options?: {
        status?: number
        message?: string
        headers?: Record<string, string>
    }
): NextResponse<SuccessResponse<T>> {
    const serializedData = serializeData(data);
    
    const response: SuccessResponse<T> = {
        success: true,
        data: serializedData,
        ...(options?.message && { message: options.message })
    }

    return NextResponse.json(response, {
        status: options?.status || 200,
        ...(options?.headers && { headers: options.headers })
    })
}

/**
 * Create a standardized error response
 */
export function apiError(
    error: string,
    code: string,
    options?: {
        status?: number
        details?: Record<string, unknown>
        headers?: Record<string, string>
    }
): NextResponse<ErrorResponse> {
    const response: ErrorResponse = {
        success: false,
        error,
        code,
        ...(options?.details && { details: options.details })
    }

    return NextResponse.json(response, {
        status: options?.status || 400,
        ...(options?.headers && { headers: options.headers })
    })
}

/**
 * Common error codes
 */
export const ErrorCodes = {
    // Authentication & Authorization
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    SESSION_EXPIRED: 'SESSION_EXPIRED',
    INVALID_TOKEN: 'INVALID_TOKEN',
    
    // Validation
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    BAD_REQUEST: 'BAD_REQUEST',
    MISSING_FIELD: 'MISSING_FIELD',
    INVALID_FORMAT: 'INVALID_FORMAT',
    INVALID_COORDINATES: 'INVALID_COORDINATES',
    INVALID_STATUS: 'INVALID_STATUS',
    
    // Resource
    NOT_FOUND: 'NOT_FOUND',
    ALREADY_EXISTS: 'ALREADY_EXISTS',
    CONFLICT: 'CONFLICT',
    
    // Business Logic
    ALREADY_CHECKED_IN: 'ALREADY_CHECKED_IN',
    NO_ACTIVE_SESSION: 'NO_ACTIVE_SESSION',
    OUTSIDE_GEOFENCE: 'OUTSIDE_GEOFENCE',
    OUTSIDE_SCHEDULE: 'OUTSIDE_SCHEDULE',
    BUSINESS_LOGIC_ERROR: 'BUSINESS_LOGIC_ERROR',
    
    // Server
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR'
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]

/**
 * Helper to wrap async route handlers with error handling
 */
// Helper to wrap async route handlers with error handling
export function withErrorHandler(
    handler: (req: NextRequest, context?: unknown) => Promise<NextResponse<unknown>>
) {
    return async (req: NextRequest, context?: unknown): Promise<NextResponse<unknown>> => {
        try {
            return await handler(req, context)
        } catch (error: unknown) {
            console.error('[API Error]', error)
            
            if (error instanceof Error) {
                // Check for known error types
                if (error.message === 'NO_ACTIVE_SESSION') {
                    return apiError('Tidak ada sesi aktif', ErrorCodes.NO_ACTIVE_SESSION, { status: 404 })
                }
                if (error.message === 'ALREADY_CHECKED_IN') {
                    return apiError('Anda sudah check-in hari ini', ErrorCodes.ALREADY_CHECKED_IN, { status: 409 })
                }
            }
            
            return apiError(
                'Terjadi kesalahan pada server',
                ErrorCodes.INTERNAL_ERROR,
                { status: 500 }
            )
        }
    }
}

/**
 * Paginated success response
 */
export interface PaginatedResponse<T> extends SuccessResponse<T[]> {
    meta: {
        page: number
        limit: number
        total: number
        totalPages: number
    }
}

export function apiPaginated<T>(
    data: T[],
    options: {
        page: number
        limit: number
        total: number
        message?: string
    }
): NextResponse<PaginatedResponse<T>> {
    const serializedData = serializeData(data) as T[];

    const response: PaginatedResponse<T> = {
        success: true,
        data: serializedData,
        meta: {
            page: options.page,
            limit: options.limit,
            total: options.total,
            totalPages: Math.ceil(options.total / options.limit),
        },
        ...(options.message && { message: options.message }),
    }

    return NextResponse.json(response, { status: 200 })
}

/**
 * Paginated response with summary data
 * Used when response includes both paginated data and aggregated summary
 */
export interface PaginatedWithSummaryResponse<T, S = unknown> extends SuccessResponse<T[]> {
    meta: {
        page: number
        limit: number
        total: number
        totalPages: number
    }
    summary?: S
}

export function apiPaginatedWithSummary<T, S = unknown>(
    data: T[],
    options: {
        page: number
        limit: number
        total: number
        summary?: S
        message?: string
    }
): NextResponse<PaginatedWithSummaryResponse<T, S>> {
    const serializedData = serializeData(data) as T[];
    const serializedSummary = options.summary ? serializeData(options.summary) as S : undefined;

    const response: PaginatedWithSummaryResponse<T, S> = {
        success: true,
        data: serializedData,
        meta: {
            page: options.page,
            limit: options.limit,
            total: options.total,
            totalPages: Math.ceil(options.total / options.limit),
        },
        ...(serializedSummary && { summary: serializedSummary }),
        ...(options.message && { message: options.message }),
    }

    return NextResponse.json(response, { status: 200 })
}

/**
 * Common error response shortcuts
 */
export const ApiErrors = {
    unauthorized: (message = 'Tidak terautentikasi') =>
        apiError(message, ErrorCodes.UNAUTHORIZED, { status: 401 }),

    forbidden: (message = 'Akses ditolak') =>
        apiError(message, ErrorCodes.FORBIDDEN, { status: 403 }),

    notFound: (resource = 'Data') =>
        apiError(`${resource} tidak ditemukan`, ErrorCodes.NOT_FOUND, { status: 404 }),

    badRequest: (message: string, details?: Record<string, unknown>) =>
        apiError(message, ErrorCodes.VALIDATION_ERROR, { status: 400, ...(details && { details }) }),

    conflict: (message: string) =>
        apiError(message, ErrorCodes.CONFLICT, { status: 409 }),

    internalError: (message = 'Internal server error') =>
        apiError(message, ErrorCodes.INTERNAL_ERROR, { status: 500 }),
}

