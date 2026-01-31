/**
 * Department DTOs (Data Transfer Objects)
 */

// ==================== Response DTOs ====================

/**
 * Minimal DTO for list views
 */
export interface DepartmentListItemDTO {
    id: string
    name: string
    description: string | null
    isReminderTarget: boolean
    userCount: number
    workOrderCount: number
}

/**
 * Full DTO for detail views
 */
export interface DepartmentDetailDTO {
    id: string
    name: string
    description: string | null
    jobDescription: string | null
    isReminderTarget: boolean
    // Statistics
    stats: {
        userCount: number
        workOrderCount: number
    }
    // Sample users (first 10)
    users: {
        id: string
        name: string | null
        email: string
    }[]
    createdAt: string
    updatedAt: string
}

/**
 * DTO for dropdown/select options
 */
export interface DepartmentOptionDTO {
    id: string
    name: string
}

// ==================== Request DTOs ====================

/**
 * DTO for creating department
 */
export interface CreateDepartmentDTO {
    name: string
    description?: string
    jobDescription?: string
    isReminderTarget?: boolean
}

/**
 * DTO for updating department
 */
export interface UpdateDepartmentDTO {
    name?: string
    description?: string
    jobDescription?: string
    isReminderTarget?: boolean
}
