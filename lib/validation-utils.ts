/**
 * Validation Utilities - Shared validation functions
 * Centralizes common validation logic to ensure consistency
 */

export interface ValidationResult {
    valid: boolean
    error?: string
    code?: string
}

/**
 * Valid attendance status values (matching Prisma enum)
 */
export const VALID_ATTENDANCE_STATUSES = [
    'ON_TIME',
    'LATE', 
    'ABSENT',
    'SICK',
    'PERMIT',
    'DAY_OFF'
] as const

export type AttendanceStatusType = typeof VALID_ATTENDANCE_STATUSES[number]

/**
 * Validate geographic coordinates
 * @param lat - Latitude value (can be string or number)
 * @param lng - Longitude value (can be string or number)
 * @returns Validation result with parsed coordinates if valid
 */
export function validateCoordinates(
    lat: number | string | undefined | null,
    lng: number | string | undefined | null
): ValidationResult & { latitude?: number; longitude?: number } {
    // Coordinates are optional in many contexts
    if (lat === undefined || lat === null || lng === undefined || lng === null) {
        return { valid: true }
    }

    const latitude = typeof lat === 'string' ? parseFloat(lat) : lat
    const longitude = typeof lng === 'string' ? parseFloat(lng) : lng

    if (isNaN(latitude) || isNaN(longitude)) {
        return {
            valid: false,
            error: 'Koordinat tidak valid',
            code: 'INVALID_COORDINATES'
        }
    }

    if (latitude < -90 || latitude > 90) {
        return {
            valid: false,
            error: 'Latitude harus antara -90 dan 90',
            code: 'INVALID_LATITUDE'
        }
    }

    if (longitude < -180 || longitude > 180) {
        return {
            valid: false,
            error: 'Longitude harus antara -180 dan 180',
            code: 'INVALID_LONGITUDE'
        }
    }

    return { valid: true, latitude, longitude }
}

/**
 * Validate attendance status value
 * @param status - Status value to validate
 * @returns Validation result
 */
export function validateAttendanceStatus(status: string): ValidationResult {
    if (!VALID_ATTENDANCE_STATUSES.includes(status as any)) {
        return {
            valid: false,
            error: `Status tidak valid. Pilihan: ${VALID_ATTENDANCE_STATUSES.join(', ')}`,
            code: 'INVALID_STATUS'
        }
    }
    return { valid: true }
}

/**
 * Validate required string field
 * @param value - Value to check
 * @param fieldName - Name of field for error message
 * @returns Validation result
 */
export function validateRequired(
    value: string | undefined | null,
    fieldName: string
): ValidationResult {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
        return {
            valid: false,
            error: `${fieldName} wajib diisi`,
            code: 'REQUIRED_FIELD'
        }
    }
    return { valid: true }
}

/**
 * Validate pagination parameters
 * @param page - Page number
 * @param limit - Items per page
 * @param maxLimit - Maximum allowed limit (default 100)
 * @returns Validated pagination values
 */
export function validatePagination(
    page: number | string | undefined,
    limit: number | string | undefined,
    maxLimit: number = 100
): { page: number; limit: number; skip: number } {
    let parsedPage = typeof page === 'string' ? parseInt(page) : page
    let parsedLimit = typeof limit === 'string' ? parseInt(limit) : limit

    // Ensure valid values
    parsedPage = isNaN(parsedPage as number) || (parsedPage as number) < 1 ? 1 : parsedPage as number
    parsedLimit = isNaN(parsedLimit as number) || (parsedLimit as number) < 1 ? 10 : parsedLimit as number
    parsedLimit = Math.min(parsedLimit, maxLimit)

    return {
        page: parsedPage,
        limit: parsedLimit,
        skip: (parsedPage - 1) * parsedLimit
    }
}

/**
 * Validate date range
 * @param days - Number of days (from query param)
 * @param maxDays - Maximum allowed days (default 365)
 * @param defaultDays - Default value if invalid (default 30)
 * @returns Validated days value
 */
export function validateDaysRange(
    days: number | string | undefined | null,
    maxDays: number = 365,
    defaultDays: number = 30
): number {
    if (days === undefined || days === null) return defaultDays
    
    const parsed = typeof days === 'string' ? parseInt(days) : days
    if (isNaN(parsed)) return defaultDays
    
    return Math.min(Math.max(parsed, 1), maxDays)
}
