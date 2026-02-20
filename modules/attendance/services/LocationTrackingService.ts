import { prisma } from '@/lib/prisma'
import { calculateHaversineDistance } from '@/lib/geo-utils'
import { type Server as SocketIOServer } from 'socket.io'

interface LocationData {
    latitude: number
    longitude: number
    accuracy?: number
    altitude?: number
    speed?: number
    heading?: number
    batteryLevel?: number
    isMoving?: boolean
    recordedAt?: Date
}

/**
 * LocationTrackingService - Mengelola data lokasi karyawan selama jam kerja
 * Tracking aktif setelah check-in dan berhenti setelah check-out
 */
export class LocationTrackingService {
    private readonly LOCATION_RETENTION_DAYS = 30 // Simpan data 30 hari
    private io: SocketIOServer | null = null

    constructor() {
        const globalAny = globalThis as unknown as { socketIOServer: SocketIOServer | null }
        if (globalAny.socketIOServer) {
            this.io = globalAny.socketIOServer
        }
    }

    /**
     * Simpan lokasi baru untuk user
     */
    async saveLocation(userId: string, data: LocationData): Promise<void> {
        const location = await prisma.employeeLocation.create({
            data: {
                userId,
                latitude: data.latitude,
                longitude: data.longitude,
                accuracy: data.accuracy ?? null,
                altitude: data.altitude ?? null,
                speed: data.speed ?? null,
                heading: data.heading ?? null,
                batteryLevel: data.batteryLevel ?? null,
                isMoving: data.isMoving ?? false,
                recordedAt: data.recordedAt ?? new Date()
            }
        })

        // Emit realtime update to admin
        if (this.io) {
            this.io.to('admin:location').emit('admin:location:update', {
                userId,
                latitude: location.latitude,
                longitude: location.longitude,
                heading: location.heading,
                isMoving: location.isMoving,
                batteryLevel: location.batteryLevel,
                recordedAt: location.recordedAt,
                // Include generic accuracy/speed if helpful for UI map
                accuracy: location.accuracy,
                speed: location.speed
            })
        }
    }

    /**
     * Batch save multiple locations (untuk sync offline)
     */
    async saveLocations(userId: string, locations: LocationData[]): Promise<number> {
        const result = await prisma.employeeLocation.createMany({
            data: locations.map(loc => ({
                userId,
                latitude: loc.latitude,
                longitude: loc.longitude,
                accuracy: loc.accuracy ?? null,
                altitude: loc.altitude ?? null,
                speed: loc.speed ?? null,
                heading: loc.heading ?? null,
                batteryLevel: loc.batteryLevel ?? null,
                isMoving: loc.isMoving ?? false,
                recordedAt: loc.recordedAt ?? new Date()
            }))
        })

        // Emit the latest location in the batch
        if (this.io && locations.length > 0) {
            // Find latest by date
            const latest = locations.reduce((prev, current) => {
                const prevDate = prev.recordedAt ? new Date(prev.recordedAt) : new Date(0)
                const currDate = current.recordedAt ? new Date(current.recordedAt) : new Date(0)
                return (prevDate > currDate) ? prev : current
            })

            this.io.to('admin:location').emit('admin:location:update', {
                userId,
                latitude: latest.latitude,
                longitude: latest.longitude,
                heading: latest.heading,
                isMoving: latest.isMoving ?? false,
                batteryLevel: latest.batteryLevel,
                recordedAt: latest.recordedAt ?? new Date(),
                accuracy: latest.accuracy,
                speed: latest.speed
            })
        }

        return result.count
    }

    /**
     * Helper to get today's start (00:00) in WIB (UTC+7) converted back to UTC
     */
    private getTodayWIBStartUTC(): Date {
        const now = new Date()
        const wibOffset = 7 * 60 // WIB is UTC+7, convert to minutes
        const utcOffset = now.getTimezoneOffset() // Server's offset in minutes (negative for UTC+)
        const totalOffset = wibOffset + utcOffset // Total offset from server time to WIB
        
        // Create "today at 00:00 WIB" in UTC
        const todayWIB = new Date(now.getTime() + totalOffset * 60 * 1000)
        todayWIB.setHours(0, 0, 0, 0)
        return new Date(todayWIB.getTime() - totalOffset * 60 * 1000)
    }

    /**
     * Cek apakah user sedang dalam status aktif (sudah check-in, belum check-out)
     */
    async isUserCurrentlyCheckedIn(userId: string): Promise<boolean> {
        const todayUTC = this.getTodayWIBStartUTC()

        const activeAttendance = await prisma.attendance.findFirst({
            where: {
                userId,
                checkIn: { gte: todayUTC },
                checkOut: null
            }
        })

        return !!activeAttendance
    }

    /**
     * Ambil lokasi terakhir untuk semua karyawan yang sedang aktif (untuk Live Map)
     * @param filters Optional filters for RBAC (siteId, departmentId)
     */
    async getLiveLocations(filters?: { siteId?: string; departmentId?: string }): Promise<Array<{
        userId: string
        userName: string
        userImage: string | null
        siteName: string | null
        departmentName: string | null
        latitude: number
        longitude: number
        accuracy: number | null
        speed: number | null
        heading: number | null
        isMoving: boolean
        batteryLevel: number | null
        recordedAt: Date
        checkInTime: Date
    }>> {
        // Calculate today's start in WIB timezone (UTC+7)
        // When it's 00:00 WIB, it's 17:00 UTC previous day
        const now = new Date()
        const wibOffset = 7 * 60 // WIB is UTC+7, convert to minutes
        const utcOffset = now.getTimezoneOffset() // Server's offset in minutes (negative for UTC+)
        const totalOffset = wibOffset + utcOffset // Total offset from server time to WIB
        
        // Create "today at 00:00 WIB" in UTC
        const todayWIB = new Date(now.getTime() + totalOffset * 60 * 1000)
        todayWIB.setHours(0, 0, 0, 0)
        const todayUTC = new Date(todayWIB.getTime() - totalOffset * 60 * 1000)

        // Build user filter for RBAC restrictions
        const userFilter: { siteId?: string; departmentId?: string } = {};
        if (filters?.siteId) {
            userFilter.siteId = filters.siteId;
        }
        if (filters?.departmentId) {
            userFilter.departmentId = filters.departmentId;
        }

        // Cari semua user yang sedang check-in (belum check-out)
        const activeAttendances = await prisma.attendance.findMany({
            where: {
                checkIn: { gte: todayUTC },
                checkOut: null,
                user: Object.keys(userFilter).length > 0 ? userFilter : undefined
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        image: true,
                        sites: { select: { name: true } },
                        departments: { select: { name: true } }
                    }
                }
            }
        })

        // Early return if no active attendances
        if (activeAttendances.length === 0) {
            return []
        }

        // OPTIMIZED: Batch fetch latest locations in SINGLE query
        // This eliminates N+1 query problem (was: 1 query per user)
        const userIds = activeAttendances.map(a => a.userId)
        
        // Use raw query for DISTINCT ON (PostgreSQL specific - most efficient)
        const latestLocations = await prisma.$queryRaw<Array<{
            userId: string
            latitude: number
            longitude: number
            accuracy: number | null
            speed: number | null
            heading: number | null
            isMoving: boolean
            batteryLevel: number | null
            recordedAt: Date
        }>>`
            SELECT DISTINCT ON ("userId") 
                "userId", latitude, longitude, accuracy, speed, 
                heading, "isMoving", "batteryLevel", "recordedAt"
            FROM "employee_locations"
            WHERE "userId" = ANY(${userIds})
            ORDER BY "userId", "recordedAt" DESC
        `

        // Create lookup map for O(1) access
        const locationMap = new Map(
            latestLocations.map(loc => [loc.userId, loc])
        )

        // Map results with location data
        const results = activeAttendances
            .map(attendance => {
                const location = locationMap.get(attendance.userId)
                if (!location) return null

                return {
                    userId: attendance.userId,
                    userName: attendance.user.name || 'Unknown',
                    userImage: attendance.user.image,
                    siteName: attendance.user.sites?.name || null,
                    departmentName: attendance.user.departments?.name || null,
                    latitude: location.latitude,
                    longitude: location.longitude,
                    accuracy: location.accuracy,
                    speed: location.speed,
                    heading: location.heading,
                    isMoving: location.isMoving,
                    batteryLevel: location.batteryLevel,
                    recordedAt: location.recordedAt,
                    checkInTime: attendance.checkIn
                }
            })
            .filter((r): r is NonNullable<typeof r> => r !== null)

        return results
    }

    /**
     * Ambil history lokasi untuk user tertentu dalam rentang waktu
     */
    async getLocationHistory(
        userId: string,
        startDate: Date,
        endDate: Date
    ): Promise<Array<{
        latitude: number
        longitude: number
        accuracy: number | null
        speed: number | null
        isMoving: boolean
        recordedAt: Date
    }>> {
        const locations = await prisma.employeeLocation.findMany({
            where: {
                userId,
                recordedAt: {
                    gte: startDate,
                    lte: endDate
                }
            },
            orderBy: { recordedAt: 'asc' },
            select: {
                latitude: true,
                longitude: true,
                accuracy: true,
                speed: true,
                isMoving: true,
                recordedAt: true
            }
        })

        return locations
    }

    /**
     * Hapus data lokasi yang lebih tua dari retention period
     */
    async cleanupOldLocations(): Promise<number> {
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - this.LOCATION_RETENTION_DAYS)

        const result = await prisma.employeeLocation.deleteMany({
            where: {
                recordedAt: { lt: cutoffDate }
            }
        })

        return result.count
    }

    /**
     * Hitung statistik lokasi untuk user
     */
    async getLocationStats(userId: string, date: Date): Promise<{
        totalPoints: number
        firstLocation: Date | null
        lastLocation: Date | null
        totalDistance: number
    }> {
        const startOfDay = new Date(date)
        startOfDay.setHours(0, 0, 0, 0)
        
        const endOfDay = new Date(date)
        endOfDay.setHours(23, 59, 59, 999)

        const locations = await prisma.employeeLocation.findMany({
            where: {
                userId,
                recordedAt: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            },
            orderBy: { recordedAt: 'asc' },
            select: {
                latitude: true,
                longitude: true,
                recordedAt: true
            }
        })

        if (locations.length === 0) {
            return {
                totalPoints: 0,
                firstLocation: null,
                lastLocation: null,
                totalDistance: 0
            }
        }

        // Calculate total distance traveled
        let totalDistance = 0
        for (let i = 1; i < locations.length; i++) {
            const prev = locations[i - 1]
            const curr = locations[i]

            if (prev && curr) {
                totalDistance += this.calculateDistance(
                    prev.latitude,
                    prev.longitude,
                    curr.latitude,
                    curr.longitude
                )
            }
        }

        const first = locations[0]
        const last = locations[locations.length - 1]

        return {
            totalPoints: locations.length,
            firstLocation: first?.recordedAt ?? null,
            lastLocation: last?.recordedAt ?? null,
            totalDistance: Math.round(totalDistance)
        }
    }

    /**
     * Haversine formula untuk menghitung jarak
     */
    private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
        return calculateHaversineDistance(lat1, lng1, lat2, lng2)
    }
}
