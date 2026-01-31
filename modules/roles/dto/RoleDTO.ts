/**
 * Role & Permission DTOs (Data Transfer Objects)
 */

// ==================== Response DTOs ====================

/**
 * Minimal DTO for list views
 */
export interface RoleListItemDTO {
    id: string
    name: string
    description: string | null
    userCount: number
    accessAdminPanel: boolean
    accessEmployeePanel: boolean
    isRestricted: boolean
    isTechnical: boolean
}

/**
 * Full DTO for detail views
 */
export interface RoleDetailDTO {
    id: string
    name: string
    description: string | null
    accessAdminPanel: boolean
    accessEmployeePanel: boolean
    isRestricted: boolean
    isTechnical: boolean
    createdAt: string
    updatedAt: string
    // Permissions grouped by resource
    permissions: PermissionGroupDTO[]
    // Flat permission list
    permissionList: string[] // ["users:read", "users:create", ...]
    userCount: number
}

/**
 * DTO for permission groups (for UI display)
 */
export interface PermissionGroupDTO {
    resource: string
    actions: string[]
}

/**
 * DTO for individual permission
 */
export interface PermissionDTO {
    id: string
    name: string
    resource: string
    action: string
    description: string | null
}

/**
 * DTO for dropdown/select options
 */
export interface RoleOptionDTO {
    id: string
    name: string
    isRestricted: boolean
}

// ==================== Request DTOs ====================

/**
 * DTO for creating role
 */
export interface CreateRoleDTO {
    name: string
    description?: string
    permissions: string[] // ["users:read", "users:create", ...]
    accessAdminPanel?: boolean
    accessEmployeePanel?: boolean
    isRestricted?: boolean
    isTechnical?: boolean
}

/**
 * DTO for updating role
 */
export interface UpdateRoleDTO {
    name?: string
    description?: string
    permissions?: string[]
    accessAdminPanel?: boolean
    accessEmployeePanel?: boolean
    isRestricted?: boolean
    isTechnical?: boolean
}
