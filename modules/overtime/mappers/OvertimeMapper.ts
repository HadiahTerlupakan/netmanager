/**
 * OvertimeMapper
 *
 * Transforms Prisma entities to DTOs for API responses.
 */

import type { Overtime } from '@prisma/client'
import type {
    OvertimeListItemDTO,
    OvertimeDetailDTO,
    OvertimeSummaryDTO,
} from '../dto/OvertimeDTO'

// Extended types
type OvertimeWithRelations = Overtime & {
    user?: {
        id: string
        name: string | null
        email: string
    }
    approver?: {
        id: string
        name: string | null
    } | null
}

export class OvertimeMapper {
    /**
     * Map to list item DTO
     */
    static toListItem(entity: OvertimeWithRelations): OvertimeListItemDTO {
        return {
            id: entity.id,
            employeeName: entity.user?.name ?? null,
            employeeEmail: entity.user?.email ?? '',
            reason: entity.reason,
            startTime: entity.startTime?.toISOString() ?? null,
            endTime: entity.endTime?.toISOString() ?? null,
            duration: entity.duration,
            status: entity.status,
            isHolidayOvertime: entity.isHolidayOvertime,
            createdAt: entity.createdAt.toISOString(),
        }
    }

    /**
     * Map array to list items
     */
    static toListItems(entities: OvertimeWithRelations[]): OvertimeListItemDTO[] {
        return entities.map(entity => this.toListItem(entity))
    }

    /**
     * Map to detail DTO
     */
    static toDetail(entity: OvertimeWithRelations): OvertimeDetailDTO {
        return {
            id: entity.id,
            reason: entity.reason,
            startTime: entity.startTime?.toISOString() ?? null,
            endTime: entity.endTime?.toISOString() ?? null,
            startPhoto: entity.startPhoto,
            startLocation: entity.startLocation,
            endPhoto: entity.endPhoto,
            endLocation: entity.endLocation,
            duration: entity.duration,
            status: entity.status,
            rejectionReason: entity.rejectionReason,
            isHolidayOvertime: entity.isHolidayOvertime,
            isNationalHoliday: entity.isNationalHoliday,
            isOffDay: entity.isOffDay,
            holidayDescription: entity.holidayDescription,
            createdAt: entity.createdAt.toISOString(),
            updatedAt: entity.updatedAt.toISOString(),
            employee: {
                id: entity.user?.id ?? entity.userId,
                name: entity.user?.name ?? null,
                email: entity.user?.email ?? '',
            },
            approvedBy: entity.approver ? {
                id: entity.approver.id,
                name: entity.approver.name,
            } : null,
        }
    }

    /**
     * Calculate summary from overtime list
     */
    static toSummary(entities: Overtime[]): OvertimeSummaryDTO {
        const pendingCount = entities.filter(e => e.status === 'PENDING').length
        const approvedCount = entities.filter(e => e.status === 'APPROVED').length
        const rejectedCount = entities.filter(e => e.status === 'REJECTED').length
        const holidayOvertimeCount = entities.filter(e => e.isHolidayOvertime).length

        const totalMinutes = entities
            .filter(e => e.status === 'APPROVED' && e.duration)
            .reduce((sum, e) => sum + (e.duration ?? 0), 0)

        return {
            totalRequests: entities.length,
            pendingCount,
            approvedCount,
            rejectedCount,
            totalHours: Math.round(totalMinutes / 60 * 10) / 10,
            holidayOvertimeCount,
        }
    }
}
