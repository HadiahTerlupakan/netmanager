/**
 * Geo Utilities - Shared functions for geographic calculations
 * Centralizes Haversine formula to eliminate code duplication
 */

const EARTH_RADIUS_METERS = 6371000

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 - Latitude of first point
 * @param lng1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lng2 - Longitude of second point
 * @returns Distance in meters
 */
export function calculateHaversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const toRad = (deg: number) => deg * (Math.PI / 180)

    const dLat = toRad(lat2 - lat1)
    const dLng = toRad(lng2 - lng1)

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return EARTH_RADIUS_METERS * c
}

/**
 * Check if a coordinate point is inside a circular zone
 * @param userLat - User's latitude
 * @param userLng - User's longitude
 * @param zoneLat - Zone center latitude
 * @param zoneLng - Zone center longitude
 * @param radiusMeters - Zone radius in meters
 * @returns True if inside zone
 */
export function isInsideZone(
    userLat: number,
    userLng: number,
    zoneLat: number,
    zoneLng: number,
    radiusMeters: number
): boolean {
    const distance = calculateHaversineDistance(userLat, userLng, zoneLat, zoneLng)
    return distance <= radiusMeters
}

/**
 * Find the nearest zone and check if inside any zone
 * @param userLat - User's latitude
 * @param userLng - User's longitude
 * @param zones - Array of zones with lat, lng, and radius
 * @returns Object with isInside flag, nearest distance, and nearest zone name
 */
export function checkNearestZone(
    userLat: number,
    userLng: number,
    zones: Array<{ latitude: number; longitude: number; radius: number; name?: string }>
): {
    isInside: boolean
    nearestDistance: number
    nearestZoneName: string | null
} {
    if (zones.length === 0) {
        return { isInside: true, nearestDistance: 0, nearestZoneName: null }
    }

    let nearestDistance = Infinity
    let nearestZoneName: string | null = null
    let isInside = false

    for (const zone of zones) {
        const distance = calculateHaversineDistance(userLat, userLng, zone.latitude, zone.longitude)
        if (distance < nearestDistance) {
            nearestDistance = distance
            nearestZoneName = zone.name || null
        }
        if (distance <= zone.radius) {
            isInside = true
        }
    }

    return {
        isInside,
        nearestDistance: Math.round(nearestDistance),
        nearestZoneName
    }
}
