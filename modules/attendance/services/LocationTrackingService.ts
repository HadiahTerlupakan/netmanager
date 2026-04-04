import { getTenantIdFromContext } from '@/lib/tenant-context'
import { calculateHaversineDistance } from '@/lib/geo-utils'
import { type Server as SocketIOServer } from 'socket.io'
import { toStartOfDay, toEndOfDay } from '@/lib/utils/server-datetime'
import { getTimezone } from '@/lib/utils/get-timezone'
import { LocationTrackingRepository, type LocationData } from '../repositories/LocationTrackingRepository'
import { AttendanceRepository } from '../repositories/AttendanceRepository'
import { UserRepository } from '@/modules/users/repositories/UserRepository'

/**
 * LocationTrackingService - Mengelola data lokasi karyawan selama jam kerja
 * Tracking aktif setelah check-in dan berhenti setelah check-out
 */
export class LocationTrackingService {
    private readonly LOCATION_RETENTION_DAYS = 30 // Simpan data 30 hari
    private io: SocketIOServer | null = null
    private locationRepo = new LocationTrackingRepository()
    private attendanceRepo = new AttendanceRepository()
    private userRepo = new UserRepository()

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
        // Fetch user's tenantId for socket room isolation
        const user = await this.userRepo.findById(userId)

        const location = await this.locationRepo.createLocation(userId, user?.tenantId, data)

        // Emit realtime update to admin
        if (this.io && user?.tenantId) {
            const roomName = `admin:location:${user.tenantId}`
            this.io.to(roomName).emit('admin:location:update', {
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
        // Fetch user's tenantId for socket room isolation
        const user = await this.userRepo.findById(userId)

        const result = await this.locationRepo.createLocationsBatch(userId, user?.tenantId, locations)

        // Emit the latest location in the batch
        if (this.io && user?.tenantId && locations.length > 0) {
            // Find latest by date
            const latest = locations.reduce((prev, current) => {
                const prevDate = prev.recordedAt ? new Date(prev.recordedAt) : new Date(0)
                const currDate = current.recordedAt ? new Date(current.recordedAt) : new Date(0)
                return (prevDate > currDate) ? prev : current
            })

            const roomName = `admin:location:${user.tenantId}`
            this.io.to(roomName).emit('admin:location:update', {
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
     * Helper to get today's start (00:00) in tenant's timezone converted back to UTC
     */
    private async getTodayTenantStartUTC(tenantId?: string): Promise<Date> {
        const timezone = await getTimezone(tenantId)
        return toStartOfDay(new Date(), timezone)
    }

    /**
     * Cek apakah user sedang dalam status aktif (sudah check-in, belum check-out)
     */
    async isUserCurrentlyCheckedIn(userId: string): Promise<boolean> {
        // Get user's tenantId first
        const user = await this.userRepo.findById(userId)

        const todayUTC = await this.getTodayTenantStartUTC(user?.tenantId || undefined)

        const activeAttendance = await this.attendanceRepo.findFirst({
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
        type ActiveAttendanceWithUser = {
            userId: string
            checkIn: Date
            user: {
                id: string
                name: string | null
                image: string | null
                sites: { name: string } | null
                departments: { name: string } | null
            }
        }

        // Calculate today's start in WIB timezone (UTC+7)
        // When it's 00:00 WIB, it's 17:00 UTC previous day
        const now = new Date()
        const wibOffset = 7 * 60 // WIB is UTC+7, convert to minutes
        const utcOffset = now.getTimezoneOffset() // Server's offset in minutes (negative for UTC+)
        const totalOffset = wibOffset + utcOffset // Total offset from server time to WIB
        
        // Create "today at 00:00 WIB" in UTC
        const todayWIB = new Date(now.getTime() + totalOffset * 60 * 1000)
        todayWIB.setTime(toStartOfDay(todayWIB).getTime())
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
        const activeAttendances = await this.attendanceRepo.findMany({
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
        }) as ActiveAttendanceWithUser[]

        // Early return if no active attendances
        if (activeAttendances.length === 0) {
            return []
        }

        // OPTIMIZED: Batch fetch latest locations in SINGLE query
        // This eliminates N+1 query problem (was: 1 query per user)
        const userIds = activeAttendances.map(a => a.userId)
        
        const { tenantId, isSuperAdmin } = await getTenantIdFromContext()
        const effectiveTenantId = (!isSuperAdmin && !tenantId) ? '___MISSING_TENANT_ID___' : tenantId

        const latestLocations = await this.locationRepo.getLatestLocationsForUsers(userIds, effectiveTenantId, isSuperAdmin)

        // Create lookup map for O(1) access
        const locationMap = new Map(
            latestLocations.map(loc => [loc.userId, loc])
        )

        // Map results with location data
        const results = activeAttendances
            .map(attendance => {
                const location = locationMap.get(attendance.userId)
                if (!location) return null
                
                const userData = attendance.user

                return {
                    userId: attendance.userId,
                    userName: userData.name || 'Unknown',
                    userImage: userData.image,
                    siteName: userData.sites?.name || null,
                    departmentName: userData.departments?.name || null,
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
        const locations = await this.locationRepo.findLocationsByUserIdAndDateRange(userId, startDate, endDate)
        return locations
    }

    /**
     * Hapus data lokasi yang lebih tua dari retention period
     */
    async cleanupOldLocations(): Promise<number> {
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - this.LOCATION_RETENTION_DAYS)

        const result = await this.locationRepo.deleteLocationsBefore(cutoffDate)
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
        startOfDay.setTime(toStartOfDay(startOfDay).getTime())
        
        const endOfDay = new Date(date)
        endOfDay.setTime(toEndOfDay(endOfDay).getTime())

        const locations = await this.locationRepo.findLocationsByUserIdAndDateRange(userId, startOfDay, endOfDay)

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
