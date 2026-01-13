/**
 * Coordinate Validation Utility
 * Standarisasi validasi latitude dan longitude untuk mengurangi duplikasi kode
 */

interface CoordinateValidationResult {
    valid: boolean
    latitude?: number
    longitude?: number
    error?: string
}

/**
 * Validate and parse coordinate values from string or number
 * @param latInput - Latitude value (string or number)
 * @param lngInput - Longitude value (string or number)
 * @returns Validation result with parsed coordinates or error message
 */
export function validateCoordinates(
    latInput: string | number | undefined,
    lngInput: string | number | undefined
): CoordinateValidationResult {
    // Skip validation if no coordinates provided
    if (latInput === undefined || lngInput === undefined) {
        return { valid: true }
    }

    const lat = typeof latInput === 'string' ? parseFloat(latInput) : latInput
    const lng = typeof lngInput === 'string' ? parseFloat(lngInput) : lngInput

    if (isNaN(lat) || isNaN(lng)) {
        return { valid: false, error: 'Koordinat tidak valid' }
    }

    if (lat < -90 || lat > 90) {
        return { valid: false, error: 'Latitude harus antara -90 dan 90' }
    }

    if (lng < -180 || lng > 180) {
        return { valid: false, error: 'Longitude harus antara -180 dan 180' }
    }

    return { valid: true, latitude: lat, longitude: lng }
}

/**
 * Validate coordinates and return NextResponse error if invalid
 * @param latInput - Latitude value
 * @param lngInput - Longitude value
 * @returns { coordinates, errorResponse } - coordinates if valid, errorResponse if invalid
 */
export function validateCoordinatesOrError(
    latInput: string | number | undefined,
    lngInput: string | number | undefined
): { 
    coordinates?: { latitude: number; longitude: number }
    errorResponse?: Response 
} {
    const result = validateCoordinates(latInput, lngInput)
    
    if (!result.valid) {
        // Note: Import NextResponse in the calling file
        // This returns a plain object that can be used to construct error response
        return { 
            errorResponse: new Response(
                JSON.stringify({ error: result.error, code: 'VALIDATION_ERROR' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            )
        }
    }

    if (result.latitude !== undefined && result.longitude !== undefined) {
        return { coordinates: { latitude: result.latitude, longitude: result.longitude } }
    }

    return {}
}
