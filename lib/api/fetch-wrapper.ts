/**
 * fetch-wrapper.ts
 * Frontend utility for standardized API calls with error and rate limit handling
 */

export interface FetchError extends Error {
    status?: number;
    code?: string;
    details?: Record<string, unknown>;
    retryAfter?: number;
}

/**
 * Standardized fetch wrapper for the frontend
 */
export async function fetchWithHandling<T = unknown>(
    url: string,
    options: RequestInit = {}
): Promise<T> {
    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    // 1. Handle Rate Limiting (429)
    if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const errorData = await res.json().catch(() => ({}));
        
        const error: FetchError = new Error(errorData.error || 'Terlalu banyak permintaan. Silakan tunggu.');
        error.status = 429;
        error.code = 'RATE_LIMIT_EXCEEDED';
        error.retryAfter = retryAfter ? parseInt(retryAfter, 10) : 60;
        throw error;
    }

    // 2. Handle Success
    if (res.ok) {
        const data = await res.json();
        // Return .data if it follows our SuccessResponse format
        return data.success !== undefined ? data.data : data;
    }

    // 3. Handle Errors
    const errorData = await res.json().catch(() => ({}));
    const error: FetchError = new Error(errorData.error || 'Gagal memproses permintaan');
    error.status = res.status;
    error.code = errorData.code || 'UNKNOWN_ERROR';
    error.details = errorData.details;
    throw error;
}
