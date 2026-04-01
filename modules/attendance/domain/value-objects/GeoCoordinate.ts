/**
 * Haversine distance in meters between two geo coordinates.
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000 // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export class GeoCoordinate {
  constructor(
    public readonly latitude: number,
    public readonly longitude: number,
  ) {
    if (typeof latitude !== 'number' || isNaN(latitude) || !isFinite(latitude)) {
      throw new Error(`Invalid latitude: must be a finite number, got ${latitude}`)
    }
    if (typeof longitude !== 'number' || isNaN(longitude) || !isFinite(longitude)) {
      throw new Error(`Invalid longitude: must be a finite number, got ${longitude}`)
    }
    if (latitude < -90 || latitude > 90) {
      throw new Error(`Invalid latitude: ${latitude} (must be between -90 and 90)`)
    }
    if (longitude < -180 || longitude > 180) {
      throw new Error(`Invalid longitude: ${longitude} (must be between -180 and 180)`)
    }
  }

  distanceTo(other: GeoCoordinate): number {
    return haversineDistance(this.latitude, this.longitude, other.latitude, other.longitude)
  }

  isWithinRadius(center: GeoCoordinate, radiusMeters: number): boolean {
    return this.distanceTo(center) <= radiusMeters
  }

  equals(other: GeoCoordinate): boolean {
    return this.latitude === other.latitude && this.longitude === other.longitude
  }

  toJSON(): { latitude: number; longitude: number } {
    return { latitude: this.latitude, longitude: this.longitude }
  }
}
