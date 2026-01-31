/**
 * Site DTOs (Data Transfer Objects)
 */

// ==================== Response DTOs ====================

/**
 * Minimal DTO for list views
 */
export interface SiteListItemDTO {
    id: string
    code: string
    name: string
    address: string | null
    isActive: boolean
    userCount: number
    workOrderCount: number
}

/**
 * Full DTO for detail views
 */
export interface SiteDetailDTO {
    id: string
    code: string
    name: string
    description: string | null
    address: string | null
    isActive: boolean
    // Geolocation
    location: {
        latitude: number | null
        longitude: number | null
        attendanceRadius: number
    }
    // Statistics
    stats: {
        userCount: number
        workOrderCount: number
        pelangganCount: number
    }
    // Related warehouses
    gudangs: {
        id: string
        name: string
    }[]
    createdAt: string
    updatedAt: string
}

/**
 * DTO for dropdown/select options
 */
export interface SiteOptionDTO {
    id: string
    code: string
    name: string
}

// ==================== Request DTOs ====================

/**
 * DTO for creating site
 */
export interface CreateSiteDTO {
    code: string
    name: string
    description?: string
    address?: string
    latitude?: number
    longitude?: number
    attendanceRadius?: number
    gudangIds?: string[]
}

/**
 * DTO for updating site
 */
export interface UpdateSiteDTO {
    code?: string
    name?: string
    description?: string
    address?: string
    latitude?: number
    longitude?: number
    attendanceRadius?: number
    isActive?: boolean
    gudangIds?: string[]
}
