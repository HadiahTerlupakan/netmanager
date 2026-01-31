/**
 * Integration DTOs (Data Transfer Objects)
 */

// ==================== Response DTOs ====================

/**
 * DTO for integration config list views
 */
export interface IntegrationConfigListItemDTO {
    id: string
    name: string
    type: string
    isActive: boolean
    lastSyncAt: string | null
}

/**
 * DTO for integration config detail views
 */
export interface IntegrationConfigDetailDTO {
    id: string
    name: string
    type: string
    baseUrl: string
    isActive: boolean
    createdAt: string
    updatedAt: string
    syncStatus: IntegrationSyncStatusDTO | null
}

/**
 * DTO for sync status
 */
export interface IntegrationSyncStatusDTO {
    lastSyncAt: string | null
    lastSyncStatus: 'SUCCESS' | 'FAILED' | 'IN_PROGRESS' | null
    recordsSynced: number
    errorMessage: string | null
}

/**
 * DTO for MixRadius customer (synced data)
 */
export interface MixRadiusCustomerDTO {
    id: string
    mixRadiusId: string
    username: string
    fullName: string | null
    address: string | null
    phoneNumber: string | null
    planName: string | null
    status: string | null
    expiredOn: string | null
    lastSyncedAt: string
}

// ==================== Request DTOs ====================

/**
 * DTO for creating integration config
 */
export interface CreateIntegrationConfigDTO {
    name: string
    type: string
    baseUrl: string
    username: string
    password: string
}

/**
 * DTO for updating integration config
 */
export interface UpdateIntegrationConfigDTO {
    name?: string
    baseUrl?: string
    username?: string
    password?: string
    isActive?: boolean
}

/**
 * DTO for triggering sync
 */
export interface TriggerSyncDTO {
    configId: string
    fullSync?: boolean
}
