import { prisma } from '@/lib/prisma'
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
        if ((globalThis as any).socketIOServer) {
            this.io = (globalThis as any).socketIOServer
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
                accuracy: data.accuracy,
                altitude: data.altitude,
                speed: data.speed,
                heading: data.heading,
                batteryLevel: data.batteryLevel,
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
                accuracy: loc.accuracy,
                altitude: loc.altitude,
                speed: loc.speed,
                heading: loc.heading,
                batteryLevel: loc.batteryLevel,
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
     * Cek apakah user sedang dalam status aktif (sudah check-in, belum check-out)
     */
    async isUserCurrentlyCheckedIn(userId: string): Promise<boolean> {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const activeAttendance = await prisma.attendance.findFirst({
            where: {
                userId,
                checkIn: { gte: today },
                checkOut: null
            }
        })

        return !!activeAttendance
    }

    /**
     * Ambil lokasi terakhir untuk semua karyawan yang sedang aktif (untuk Live Map)
     */
    async getLiveLocations(): Promise<Array<{
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
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // Cari semua user yang sedang check-in (belum check-out)
        const activeAttendances = await prisma.attendance.findMany({
            where: {
                checkIn: { gte: today },
                checkOut: null
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

        // Untuk setiap user aktif, ambil lokasi terakhir
        const results = await Promise.all(
            activeAttendances.map(async (attendance) => {
                const latestLocation = await prisma.employeeLocation.findFirst({
                    where: { userId: attendance.userId },
                    orderBy: { recordedAt: 'desc' }
                })

                if (!latestLocation) return null

                return {
                    userId: attendance.userId,
                    userName: attendance.user.name || 'Unknown',
                    userImage: attendance.user.image,
                    siteName: attendance.user.sites?.name || null,
                    departmentName: attendance.user.departments?.name || null,
                    latitude: latestLocation.latitude,
                    longitude: latestLocation.longitude,
                    accuracy: latestLocation.accuracy,
                    speed: latestLocation.speed,
                    heading: latestLocation.heading,
                    isMoving: latestLocation.isMoving,
                    batteryLevel: latestLocation.batteryLevel,
                    recordedAt: latestLocation.recordedAt,
                    checkInTime: attendance.checkIn
                }
            })
        )

        return results.filter((r): r is NonNullable<typeof r> => r !== null)
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
            totalDistance += this.calculateDistance(
                locations[i - 1].latitude,
                locations[i - 1].longitude,
                locations[i].latitude,
                locations[i].longitude
            )
        }

        return {
            totalPoints: locations.length,
            firstLocation: locations[0].recordedAt,
            lastLocation: locations[locations.length - 1].recordedAt,
            totalDistance: Math.round(totalDistance)
        }
    }

    /**
     * Haversine formula untuk menghitung jarak
     */
    private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const EARTH_RADIUS_METERS = 6371000
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
}
