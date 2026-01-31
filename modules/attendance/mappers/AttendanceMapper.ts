/**
 * AttendanceMapper
 *
 * Transforms Prisma entities to DTOs for API responses.
 */

import type { Attendance } from '@prisma/client'
import type {
    AttendanceListItemDTO,
    AttendanceDetailDTO,
    CheckInResponseDTO,
    CheckOutResponseDTO,
    AttendanceSummaryDTO,
} from '../dto/AttendanceDTO'

// Extended type with relations
type AttendanceWithRelations = Attendance & {
    user?: {
        id: string
        name: string | null
        email: string
        departments?: {
            id: string
            name: string
        } | null
    } | null
}

export class AttendanceMapper {
    /**
     * Map to list item DTO
     */
    static toListItem(entity: AttendanceWithRelations): AttendanceListItemDTO {
        return {
            id: entity.id,
            date: entity.checkIn?.toISOString().split('T')[0] ?? '',
            checkInTime: entity.checkIn?.toISOString() ?? null,
            checkOutTime: entity.checkOut?.toISOString() ?? null,
            status: entity.status,
            totalHours: this.calculateHours(entity.checkIn, entity.checkOut),
            location: entity.location,
            userName: entity.user?.name ?? null,
            userEmail: entity.user?.email ?? null,
            departmentName: entity.user?.departments?.name ?? null,
        }
    }

    /**
     * Map array to list items
     */
    static toListItems(entities: AttendanceWithRelations[]): AttendanceListItemDTO[] {
        return entities.map(entity => this.toListItem(entity))
    }

    /**
     * Map to detail DTO
     */
    static toDetail(entity: AttendanceWithRelations): AttendanceDetailDTO {
        return {
            id: entity.id,
            date: entity.checkIn?.toISOString().split('T')[0] ?? '',
            checkInTime: entity.checkIn?.toISOString() ?? null,
            checkOutTime: entity.checkOut?.toISOString() ?? null,
            status: entity.status,
            totalHours: this.calculateHours(entity.checkIn, entity.checkOut),
            location: entity.location,
            notes: entity.notes,
            checkInPhoto: entity.checkInPhoto,
            checkOutPhoto: entity.checkOutPhoto,
            geofence: {
                status: entity.geofenceStatus,
                distance: entity.geofenceDistance,
                siteName: entity.geofenceSiteName,
            },
            user: entity.user ? {
                id: entity.user.id,
                name: entity.user.name,
                email: entity.user.email,
                departmentName: entity.user.departments?.name ?? null,
            } : {
                id: entity.userId,
                name: null,
                email: '',
                departmentName: null,
            },
            createdAt: entity.createdAt?.toISOString() ?? '',
            updatedAt: entity.updatedAt?.toISOString() ?? '',
        }
    }

    /**
     * Map to check-in response
     */
    static toCheckInResponse(entity: Attendance, message: string = 'Check-in berhasil'): CheckInResponseDTO {
        return {
            id: entity.id,
            checkInTime: entity.checkIn?.toISOString() ?? '',
            status: entity.status,
            location: entity.location,
            geofenceStatus: entity.geofenceStatus,
            geofenceSiteName: entity.geofenceSiteName,
            message,
        }
    }

    /**
     * Map to check-out response
     */
    static toCheckOutResponse(entity: Attendance, message: string = 'Check-out berhasil'): CheckOutResponseDTO {
        const totalHours = this.calculateHours(entity.checkIn, entity.checkOut)

        return {
            id: entity.id,
            checkInTime: entity.checkIn?.toISOString() ?? '',
            checkOutTime: entity.checkOut?.toISOString() ?? '',
            totalHours: totalHours ?? 0,
            status: entity.status,
            message,
        }
    }

    /**
     * Create summary DTO from aggregated data
     */
    static toSummary(data: {
        date: Date
        totalEmployees: number
        present: number
        late: number
        absent: number
        onLeave: number
    }): AttendanceSummaryDTO {
        const percentagePresent = data.totalEmployees > 0
            ? Math.round(((data.present + data.late) / data.totalEmployees) * 100)
            : 0

        return {
            date: data.date.toISOString().split('T')[0],
            totalEmployees: data.totalEmployees,
            present: data.present,
            late: data.late,
            absent: data.absent,
            onLeave: data.onLeave,
            percentagePresent,
        }
    }

    // ==================== Private Helpers ====================

    private static calculateHours(checkIn: Date | null, checkOut: Date | null): number | null {
        if (!checkIn || !checkOut) return null

        const diffMs = checkOut.getTime() - checkIn.getTime()
        const hours = diffMs / (1000 * 60 * 60)

        return Math.round(hours * 100) / 100 // Round to 2 decimal places
    }
}
