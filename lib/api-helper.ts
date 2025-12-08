/**
 * Helper functions for API calls from employee subdomain
 */

/**
 * Get base URL for API calls from employee subdomain
 * In development and production, Next.js handles subdomain routing internally,
 * so API calls should use relative paths (same origin) to avoid CORS issues.
 */
export function getApiBaseUrl(): string {
    // Always return empty string to use relative paths
    // This keeps all API calls on the same origin, avoiding CORS issues
    // Next.js routing handles the subdomain internally
    return ''
}

/**
 * Wrapper for fetch API that handles subdomain routing
 */
export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
    const baseUrl = getApiBaseUrl()
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`

    return fetch(fullUrl, options)
}

/**
 * API endpoints that are commonly used
 */
export const API_ENDPOINTS = {
    EMPLOYEE: {
        DASHBOARD: '/api/employee/dashboard',
        ATTENDANCE_TODAY: '/api/employee/attendance/today',
        LEAVES: '/api/employee/leaves',
        PAYSLIPS: '/api/employee/payslips',
        ME: '/api/employee/me',
    },
    // Legacy HRIS endpoints (deprecated - use EMPLOYEE instead)
    HRIS: {
        ATTENDANCE_SUMMARY: '/api/hris/attendance/summary',
        LEAVES_BALANCE: '/api/hris/leaves/balance',
        LEAVES: '/api/hris/leaves',
        PAYSLIPS_LATEST: '/api/hris/payslips/latest',
        EMPLOYEES_ME: '/api/hris/employees/me',
    }
} as const