import { prisma } from '@/lib/prisma'

/**
 * GeofenceService - Validasi lokasi absensi terhadap zona geofence Sites
 * Menggunakan Formula Haversine untuk menghitung jarak antara 2 koordinat
 */
export class GeofenceService {
    private readonly EARTH_RADIUS_METERS = 6371000 // Radius bumi dalam meter

    /**
     * Menghitung jarak antara 2 koordinat menggunakan Formula Haversine
     * @returns Jarak dalam meter
     */
    calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const toRad = (deg: number) => deg * (Math.PI / 180)
        
        const dLat = toRad(lat2 - lat1)
        const dLng = toRad(lng2 - lng1)
        
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2)
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        
        return this.EARTH_RADIUS_METERS * c
    }

    /**
     * Cek apakah koordinat berada dalam zona geofence
     */
    isInsideZone(userLat: number, userLng: number, zoneLat: number, zoneLng: number, radiusMeters: number): boolean {
        const distance = this.calculateDistance(userLat, userLng, zoneLat, zoneLng)
        return distance <= radiusMeters
    }

    /**
     * Validasi koordinat terhadap site yang dimiliki user
     * Note: User hanya memiliki 1 site (relasi singular)
     * @returns Object dengan status validasi dan info zona
     */
    async validateGeofence(userId: string, latitude: number, longitude: number): Promise<{
        isInside: boolean
        nearestDistance: number | null
        nearestSiteName: string | null
        nearestSiteId: string | null
    }> {
        // Ambil site yang dimiliki user
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
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

        // Jika user tidak ada atau tidak punya site dengan koordinat
        if (!user || !user.sites || !user.sites.isActive || 
            user.sites.latitude === null || user.sites.longitude === null) {
            return {
                isInside: true, // Jika tidak ada site, anggap valid
                nearestDistance: null,
                nearestSiteName: null,
                nearestSiteId: null
            }
        }

        const site = user.sites
        const distance = this.calculateDistance(
            latitude, longitude,
            site.latitude!, site.longitude!
        )

        const isInside = distance <= site.attendanceRadius

        return {
            isInside,
            nearestDistance: Math.round(distance),
            nearestSiteName: site.name,
            nearestSiteId: site.id
        }
    }

    /**
     * Ambil geofence zone untuk user tertentu
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

        if (!user || !user.sites || !user.sites.isActive ||
            user.sites.latitude === null || user.sites.longitude === null) {
            return []
        }

        const site = user.sites
        return [{
            siteId: site.id,
            siteName: site.name,
            latitude: site.latitude!,
            longitude: site.longitude!,
            radius: site.attendanceRadius
        }]
    }
}

