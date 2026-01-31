/**
 * AttendanceFactory
 *
 * Factory pattern for creating Attendance records with different configurations.
 */

import type { AttendanceStatus, Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'

export class AttendanceFactory {
    /**
     * Create input for normal check-in
     */
    static createCheckIn(dto: {
        userId: string
        checkInTime?: Date
        photoUrl?: string | null
        location?: string
        notes?: string
        latitude?: number
        longitude?: number
        status?: AttendanceStatus
        geofenceStatus?: string
        geofenceDistance?: number | null
        geofenceSiteName?: string | null
    }): Prisma.AttendanceUncheckedCreateInput {
        return {
            id: randomUUID(),
            userId: dto.userId,
            checkIn: dto.checkInTime ?? new Date(),
            checkInPhoto: dto.photoUrl ?? null,
            location: dto.location ?? null,
            notes: dto.notes ?? null,
            status: dto.status ?? 'ON_TIME',
            geofenceStatus: dto.geofenceStatus ?? 'UNKNOWN',
            geofenceDistance: dto.geofenceDistance ?? null,
            geofenceSiteName: dto.geofenceSiteName ?? null,
            updatedAt: new Date(),
        }
    }

    /**
     * Create input for late check-in
     */
    static createLateCheckIn(dto: {
        userId: string
        checkInTime?: Date
        photoUrl?: string | null
        location?: string
        notes?: string
        lateMinutes: number
    }): Prisma.AttendanceUncheckedCreateInput {
        const notes = dto.notes
            ? `${dto.notes}\n[Terlambat ${dto.lateMinutes} menit]`
            : `[Terlambat ${dto.lateMinutes} menit]`

        return {
            id: randomUUID(),
            userId: dto.userId,
            checkIn: dto.checkInTime ?? new Date(),
            checkInPhoto: dto.photoUrl ?? null,
            location: dto.location ?? null,
            notes,
            status: 'LATE',
            updatedAt: new Date(),
        }
    }

    /**
     * Create input for manual/admin entry
     */
    static createManualEntry(dto: {
        userId: string
        date: Date
        checkInTime: string // HH:mm format
        checkOutTime?: string // HH:mm format
        status: AttendanceStatus
        notes?: string
        createdById?: string
    }): Prisma.AttendanceUncheckedCreateInput {
        const [inHour, inMin] = dto.checkInTime.split(':').map(Number)
        const checkIn = new Date(dto.date)
        checkIn.setHours(inHour, inMin, 0, 0)

        let checkOut: Date | undefined
        if (dto.checkOutTime) {
            const [outHour, outMin] = dto.checkOutTime.split(':').map(Number)
            checkOut = new Date(dto.date)
            checkOut.setHours(outHour, outMin, 0, 0)
        }

        const adminNote = dto.createdById
            ? `[Manual entry by admin]`
            : `[Manual entry]`

        return {
            id: randomUUID(),
            userId: dto.userId,
            checkIn,
            checkOut: checkOut ?? null,
            status: dto.status,
            notes: dto.notes ? `${dto.notes}\n${adminNote}` : adminNote,
            geofenceStatus: 'MANUAL',
            updatedAt: new Date(),
        }
    }

    /**
     * Create input for offline sync (from mobile app)
     */
    static createOfflineSync(dto: {
        userId: string
        checkInTime: Date
        checkOutTime?: Date
        photoUrl?: string | null
        location?: string
        latitude?: number
        longitude?: number
        offlineCapturedAt: Date
    }): Prisma.AttendanceUncheckedCreateInput {
        return {
            id: randomUUID(),
            userId: dto.userId,
            checkIn: dto.checkInTime,
            checkOut: dto.checkOutTime ?? null,
            checkInPhoto: dto.photoUrl ?? null,
            location: dto.location ?? null,
            status: 'ON_TIME', // Will be recalculated
            geofenceStatus: 'OFFLINE',
            geofenceMeta: {
                offline: true,
                capturedAt: dto.offlineCapturedAt.toISOString(),
                syncedAt: new Date().toISOString(),
            },
            updatedAt: new Date(),
        }
    }

    /**
     * Create update input for check-out
     */
    static createCheckOutUpdate(dto: {
        checkOutTime?: Date
        photoUrl?: string | null
        notes?: string
    }): Prisma.AttendanceUpdateInput {
        return {
            checkOut: dto.checkOutTime ?? new Date(),
            checkOutPhoto: dto.photoUrl ?? null,
            ...(dto.notes && {
                notes: { set: dto.notes }
            }),
            updatedAt: new Date(),
        }
    }

    /**
     * Determine status based on check-in time vs schedule
     */
    static determineStatus(
        checkInTime: Date,
        scheduleTime: string, // HH:mm format
        gracePeriodMinutes: number = 15
    ): AttendanceStatus {
        const [scheduleHour, scheduleMin] = scheduleTime.split(':').map(Number)

        const scheduleDate = new Date(checkInTime)
        scheduleDate.setHours(scheduleHour, scheduleMin, 0, 0)

        // Add grace period
        const graceDate = new Date(scheduleDate.getTime() + gracePeriodMinutes * 60 * 1000)

        if (checkInTime <= graceDate) {
            return 'ON_TIME'
        }

        return 'LATE'
    }

    /**
     * Calculate working hours
     */
    static calculateWorkingHours(checkIn: Date, checkOut: Date): number {
        const diffMs = checkOut.getTime() - checkIn.getTime()
        const hours = diffMs / (1000 * 60 * 60)
        return Math.round(hours * 100) / 100
    }
}
