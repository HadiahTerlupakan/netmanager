/**
 * RegistrationMapper
 *
 * Transforms Prisma entities to DTOs for API responses.
 */

import type { Canvasing } from '@prisma/client'
import type {
    RegistrationListItemDTO,
    RegistrationDetailDTO,
    RegistrationStatisticsDTO,
} from '../dto/RegistrationDTO'

// Extended types
type RegistrationWithRelations = Canvasing & {
    sales?: {
        id: string
        name: string | null
        email: string
    }
    approver?: {
        id: string
        name: string | null
    } | null
}

export class RegistrationMapper {
    /**
     * Map to list item DTO
     */
    static toListItem(entity: RegistrationWithRelations): RegistrationListItemDTO {
        return {
            id: entity.id,
            nama: entity.nama,
            noTelpon: entity.noTelpon,
            alamat: entity.alamat,
            paket: entity.paket,
            status: entity.status,
            salesName: entity.sales?.name ?? null,
            createdAt: entity.createdAt.toISOString(),
        }
    }

    /**
     * Map array to list items
     */
    static toListItems(entities: RegistrationWithRelations[]): RegistrationListItemDTO[] {
        return entities.map(entity => this.toListItem(entity))
    }

    /**
     * Map to detail DTO
     */
    static toDetail(entity: RegistrationWithRelations): RegistrationDetailDTO {
        return {
            id: entity.id,
            nama: entity.nama,
            noKtp: entity.noKtp,
            noTelpon: entity.noTelpon,
            email: entity.email,
            alamat: entity.alamat,
            kabel: entity.kabel,
            odp: entity.odp,
            paket: entity.paket,
            sn: entity.sn,
            latitude: entity.latitude,
            longitude: entity.longitude,
            foto: entity.foto,
            fotoKtp: entity.fotoKtp,
            status: entity.status,
            isLocked: entity.isLocked,
            createdAt: entity.createdAt.toISOString(),
            updatedAt: entity.updatedAt.toISOString(),
            sales: {
                id: entity.sales?.id ?? entity.salesId,
                name: entity.sales?.name ?? null,
                email: entity.sales?.email ?? '',
            },
            approver: entity.approver ? {
                id: entity.approver.id,
                name: entity.approver.name,
            } : null,
            approvedAt: entity.approvedAt?.toISOString() ?? null,
            workOrderId: entity.workOrderId,
        }
    }

    /**
     * Calculate statistics from registrations
     */
    static toStatistics(entities: Canvasing[]): RegistrationStatisticsDTO {
        const total = entities.length
        const pending = entities.filter(e => e.status === 'PENDING').length
        const approved = entities.filter(e => e.status === 'APPROVED').length
        const rejected = entities.filter(e => e.status === 'REJECTED').length
        const converted = entities.filter(e => e.workOrderId !== null).length

        return {
            total,
            pending,
            approved,
            rejected,
            converted,
            conversionRate: total > 0 ? Math.round((converted / total) * 100 * 10) / 10 : 0,
        }
    }
}
