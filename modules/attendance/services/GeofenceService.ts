import { prisma } from '@/lib/prisma'
import { calculateHaversineDistance } from '@/lib/geo-utils'

/**
 * GeofenceService - Validasi lokasi absensi terhadap zona geofence Sites
 * Menggunakan Formula Haversine untuk menghitung jarak antara 2 koordinat
 * 
 * Multi-site Support: User bisa punya banyak sites via userSites relation
 */
export class GeofenceService {

    /**
     * Menghitung jarak antara 2 koordinat menggunakan Formula Haversine
     * @returns Jarak dalam meter
     */
    calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
        return calculateHaversineDistance(lat1, lng1, lat2, lng2)
    }

    /**
     * Cek apakah koordinat berada dalam zona geofence
     */
    isInsideZone(userLat: number, userLng: number, zoneLat: number, zoneLng: number, radiusMeters: number): boolean {
        const distance = this.calculateDistance(userLat, userLng, zoneLat, zoneLng)
        return distance <= radiusMeters
    }

    /**
     * Validasi koordinat terhadap sites yang dimiliki user
     * Multi-site: Cek semua sites dari userSites, fallback ke legacy sites
     * @returns Object dengan status validasi dan info zona terdekat
     */
    async validateGeofence(userId: string, latitude: number, longitude: number): Promise<{
        isInside: boolean
        nearestDistance: number | null
        nearestSiteName: string | null
        nearestSiteId: string | null
    }> {
        // Ambil sites yang dimiliki user (multi-site + legacy fallback)
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                // Multi-site: userSites relation
                userSites: {
                    select: {
                        site: {
                            select: {
                                id: true,
                                name: true,
                                latitude: true,
                                longitude: true,
                                attendanceRadius: true,
                                isActive: true
                            }
                        }
                    }
                },
                // Legacy: single site
                sites: {
                    select: {
                        id: true,
                        name: true,
                        latitude: true,
                        longitude: true,
                        attendanceRadius: true,
                        isActive: true
                    }
                }
            }
        })

        if (!user) {
            return {
                isInside: true,
                nearestDistance: null,
                nearestSiteName: null,
                nearestSiteId: null
            }
        }

        // Collect all valid sites (multi-site first, then legacy fallback)
        const validSites: Array<{
            id: string
            name: string
            latitude: number
            longitude: number
            attendanceRadius: number
        }> = []

        // Multi-site: get sites from userSites
        if (user.userSites && user.userSites.length > 0) {
            for (const us of user.userSites) {
                const site = us.site
                if (site.isActive && site.latitude !== null && site.longitude !== null) {
                    validSites.push({
                        id: site.id,
                        name: site.name,
                        latitude: site.latitude,
                        longitude: site.longitude,
                        attendanceRadius: site.attendanceRadius
                    })
                }
            }
        }

        // Legacy fallback: use single site if no userSites
        if (validSites.length === 0 && user.sites && user.sites.isActive &&
            user.sites.latitude !== null && user.sites.longitude !== null) {
            validSites.push({
                id: user.sites.id,
                name: user.sites.name,
                latitude: user.sites.latitude,
                longitude: user.sites.longitude,
                attendanceRadius: user.sites.attendanceRadius
            })
        }

        // If no valid sites, allow attendance anywhere
        if (validSites.length === 0) {
            return {
                isInside: true,
                nearestDistance: null,
                nearestSiteName: null,
                nearestSiteId: null
            }
        }

        // Check against all sites, find nearest
        let nearestDistance = Infinity
        let nearestSiteName: string | null = null
        let nearestSiteId: string | null = null
        let isInside = false

        for (const site of validSites) {
            const distance = this.calculateDistance(latitude, longitude, site.latitude, site.longitude)
            
            if (distance < nearestDistance) {
                nearestDistance = distance
                nearestSiteName = site.name
                nearestSiteId = site.id
            }
            
            if (distance <= site.attendanceRadius) {
                isInside = true
            }
        }

        return {
            isInside,
            nearestDistance: Math.round(nearestDistance),
            nearestSiteName,
            nearestSiteId
        }
    }

    /**
     * Ambil geofence zones untuk user tertentu
     * Multi-site: Return semua sites dari userSites + legacy fallback
     */
    async getZonesForUser(userId: string): Promise<Array<{
        siteId: string
        siteName: string
        latitude: number
        longitude: number
        radius: number
    }>> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                // Multi-site
                userSites: {
                    select: {
                        site: {
                            select: {
                                id: true,
                                name: true,
                                latitude: true,
                                longitude: true,
                                attendanceRadius: true,
                                isActive: true
                            }
                        }
                    }
                },
                // Legacy
                sites: {
                    select: {
                        id: true,
                        name: true,
                        latitude: true,
                        longitude: true,
                        attendanceRadius: true,
                        isActive: true
                    }
                }
            }
        })

        if (!user) return []

        const zones: Array<{
            siteId: string
            siteName: string
            latitude: number
            longitude: number
            radius: number
        }> = []

        // Multi-site: get zones from userSites
        if (user.userSites && user.userSites.length > 0) {
            for (const us of user.userSites) {
                const site = us.site
                if (site.isActive && site.latitude !== null && site.longitude !== null) {
                    zones.push({
                        siteId: site.id,
                        siteName: site.name,
                        latitude: site.latitude,
                        longitude: site.longitude,
                        radius: site.attendanceRadius
                    })
                }
            }
        }

        // Legacy fallback: use single site if no userSites
        if (zones.length === 0 && user.sites && user.sites.isActive &&
            user.sites.latitude !== null && user.sites.longitude !== null) {
            zones.push({
                siteId: user.sites.id,
                siteName: user.sites.name,
                latitude: user.sites.latitude,
                longitude: user.sites.longitude,
                radius: user.sites.attendanceRadius
            })
        }

        return zones
    }
}

