/**
 * Shift DTOs (Data Transfer Objects)
 */

// ==================== Response DTOs ====================

/**
 * DTO for shift list views
 */
export interface ShiftListItemDTO {
    id: string
    name: string
    code: string | null
    startTime: string
    endTime: string
    isActive: boolean
    userCount: number
}

/**
 * DTO for shift detail views
 */
export interface ShiftDetailDTO {
    id: string
    name: string
    code: string | null
    startTime: string
    endTime: string
    description: string | null
    isActive: boolean
    createdAt: string
    updatedAt: string
    users: {
        id: string
        name: string | null
        email: string
    }[]
}

/**
 * DTO for shift option (dropdowns)
 */
export interface ShiftOptionDTO {
    id: string
    name: string
    code: string | null
    time: string
}

// ==================== Request DTOs ====================

/**
 * DTO for creating shift
 */
export interface CreateShiftDTO {
    name: string
    code?: string
    startTime: string
    endTime: string
    description?: string
    isActive?: boolean
}

/**
 * DTO for updating shift
 */
export interface UpdateShiftDTO {
    name?: string
    code?: string
    startTime?: string
    endTime?: string
    description?: string
    isActive?: boolean
}
