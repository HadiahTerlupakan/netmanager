/**
 * IntegrationMapper
 *
 * Transforms Prisma entities to DTOs for API responses.
 */

import type { MixRadiusConfig, MixRadiusCustomer } from '@prisma/client'
import type {
    IntegrationConfigListItemDTO,
    IntegrationConfigDetailDTO,
    IntegrationSyncStatusDTO,
    MixRadiusCustomerDTO,
} from '../dto/IntegrationDTO'

export class IntegrationMapper {
    /**
     * Map to config list item DTO
     */
    static toConfigListItem(entity: MixRadiusConfig): IntegrationConfigListItemDTO {
        return {
            id: entity.id,
            name: entity.name,
            type: 'MIXRADIUS',
            isActive: entity.isActive,
            lastSyncAt: null, // Would need to join with sync logs
        }
    }

    /**
     * Map configs to list items
     */
    static toConfigListItems(entities: MixRadiusConfig[]): IntegrationConfigListItemDTO[] {
        return entities.map(entity => this.toConfigListItem(entity))
    }

    /**
     * Map to config detail DTO
     */
    static toConfigDetail(
        entity: MixRadiusConfig,
        syncStatus?: IntegrationSyncStatusDTO | null
    ): IntegrationConfigDetailDTO {
        return {
            id: entity.id,
            name: entity.name,
            type: 'MIXRADIUS',
            baseUrl: entity.baseUrl,
            isActive: entity.isActive,
            createdAt: entity.createdAt.toISOString(),
            updatedAt: entity.updatedAt.toISOString(),
            syncStatus: syncStatus ?? null,
        }
    }

    /**
     * Map MixRadius customer to DTO
     */
    static toMixRadiusCustomer(entity: MixRadiusCustomer): MixRadiusCustomerDTO {
        return {
            id: entity.id,
            mixRadiusId: entity.mixRadiusId,
            username: entity.username,
            fullName: entity.fullName,
            address: entity.address,
            phoneNumber: entity.phoneNumber,
            planName: entity.planName,
            status: entity.status,
            expiredOn: entity.expiredOn?.toISOString() ?? null,
            lastSyncedAt: entity.lastSyncedAt.toISOString(),
        }
    }

    /**
     * Map MixRadius customers to DTOs
     */
    static toMixRadiusCustomers(entities: MixRadiusCustomer[]): MixRadiusCustomerDTO[] {
        return entities.map(entity => this.toMixRadiusCustomer(entity))
    }

    /**
     * Create sync status DTO
     */
    static toSyncStatus(dto: {
        lastSyncAt: Date | null
        lastSyncStatus: 'SUCCESS' | 'FAILED' | 'IN_PROGRESS' | null
        recordsSynced: number
        errorMessage: string | null
    }): IntegrationSyncStatusDTO {
        return {
            lastSyncAt: dto.lastSyncAt?.toISOString() ?? null,
            lastSyncStatus: dto.lastSyncStatus,
            recordsSynced: dto.recordsSynced,
            errorMessage: dto.errorMessage,
        }
    }
}
