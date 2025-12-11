import { prisma } from '@/lib/prisma'
import type {
    PermissionAction,
    FeaturePermission,
    PermissionMatrix,
    MenuItem,
    MenuDefinitionData,
    FULL_ACCESS
} from '@/lib/types/permissions'

export interface EmployeePermissions {
    employeeId: string
    departmentId: string | null
    departmentName: string | null
    allowedFeatures: string[] // For backward compatibility
    permissionMatrix: PermissionMatrix // New granular permissions
    role: string | null
    customRoles?: Array<{
        id: string
        name: string
        code: string
        priority: number
        features: string[]
        matrix: PermissionMatrix
    }>
}

// ============================================================================
// PERMISSION MATRIX UTILITIES
// ============================================================================

/**
 * Parse permission matrix from CustomRole.allowedFeatures
 * Supports both legacy array format and new matrix format
 */
export function parsePermissionMatrix(allowedFeatures: string | null): PermissionMatrix {
    if (!allowedFeatures) return {}

    try {
        const parsed = JSON.parse(allowedFeatures)

        // Handle legacy format (array of strings)
        if (Array.isArray(parsed)) {
            return convertLegacyToMatrix(parsed)
        }

        // New matrix format
        return parsed as PermissionMatrix
    } catch {
        return {}
    }
}

/**
 * Convert legacy ["PELANGGAN", "FINANCE"] to matrix format
 * Legacy features get full CRUD access
 */
export function convertLegacyToMatrix(features: string[]): PermissionMatrix {
    const matrix: PermissionMatrix = {}
    features.forEach(f => {
        matrix[f] = { read: true, create: true, update: true, delete: true }
    })
    return matrix
}

/**
 * Convert permission matrix to legacy feature array (for backward compatibility)
 */
export function matrixToLegacyArray(matrix: PermissionMatrix): string[] {
    return Object.keys(matrix).filter(code => matrix[code]?.read)
}

/**
 * Check if user has specific permission for a feature
 * Supports inheritance: PELANGGAN.TAGIHAN inherits from PELANGGAN if not explicitly set
 */
export function hasFeaturePermission(
    matrix: PermissionMatrix,
    featureCode: string,
    action: PermissionAction = 'read'
): boolean {
    // Check exact match first
    const permission = matrix[featureCode]
    if (permission !== undefined) {
        return permission[action] === true
    }

    // Check parent permission (e.g., PELANGGAN.TAGIHAN inherits from PELANGGAN)
    const parts = featureCode.split('.')
    if (parts.length > 1) {
        const parentCode = parts.slice(0, -1).join('.')
        return hasFeaturePermission(matrix, parentCode, action)
    }

    return false
}

/**
 * Get permission object for a feature with inheritance
 */
export function getFeaturePermission(
    matrix: PermissionMatrix,
    featureCode: string
): FeaturePermission {
    const permission = matrix[featureCode]
    if (permission) {
        return permission
    }

    // Check parent
    const parts = featureCode.split('.')
    if (parts.length > 1) {
        const parentCode = parts.slice(0, -1).join('.')
        return getFeaturePermission(matrix, parentCode)
    }

    return { read: false, create: false, update: false, delete: false }
}

/**
 * Merge multiple permission matrices (for combining department + role permissions)
 * Later matrices override earlier ones (role overrides department)
 */
export function mergePermissionMatrices(...matrices: PermissionMatrix[]): PermissionMatrix {
    const result: PermissionMatrix = {}

    for (const matrix of matrices) {
        for (const [code, perms] of Object.entries(matrix)) {
            const typedPerms = perms as FeaturePermission
            if (!result[code]) {
                result[code] = { ...typedPerms }
            } else {
                // Merge permissions (OR logic - if any source grants, result grants)
                result[code] = {
                    read: result[code].read || typedPerms.read,
                    create: result[code].create || typedPerms.create,
                    update: result[code].update || typedPerms.update,
                    delete: result[code].delete || typedPerms.delete,
                }
            }
        }
    }

    return result
}


// ============================================================================
// MENU FILTERING
// ============================================================================

/**
 * Filter menu items based on permission matrix
 */
export function filterMenuByPermissions(
    menus: MenuItem[],
    matrix: PermissionMatrix
): MenuItem[] {
    return menus.filter(menu => {
        // Must have at least read permission
        if (!hasFeaturePermission(matrix, menu.code, 'read')) {
            return false
        }

        return true
    }).map(menu => {
        const filtered = { ...menu }

        // Include resolved permissions for this menu
        filtered.permissions = getFeaturePermission(matrix, menu.code)

        // Filter children recursively
        if (menu.children && menu.children.length > 0) {
            filtered.children = filterMenuByPermissions(menu.children, matrix)
        }

        return filtered
    }).filter(menu => {
        // Remove parents with no visible children (unless they have their own path)
        if (menu.children && menu.children.length === 0 && !menu.path) {
            return false
        }
        return true
    })
}

/**
 * Legacy: Filter navigation items based on allowed features array
 */
export function filterNavigationByPermissions<T extends { feature?: string }>(
    navItems: T[],
    allowedFeatures: string[]
): T[] {
    return navItems.filter(item => {
        if (!item.feature) return true
        return hasPermission(allowedFeatures, item.feature)
    })
}

// ============================================================================
// EMPLOYEE PERMISSIONS
// ============================================================================

/**
 * Get employee permissions based on their department AND custom roles
 * ADMIN users get all features regardless of department/roles
 */
export async function getEmployeePermissions(
    employeeId: string,
    userRole?: string
): Promise<EmployeePermissions | null> {
    try {
        // If user is ADMIN, return all features with full access
        if (userRole === 'ADMIN') {
            const allFeatures = getAllFeatures()
            const fullMatrix: PermissionMatrix = {}
            allFeatures.forEach(f => {
                fullMatrix[f] = { read: true, create: true, update: true, delete: true }
            })

            return {
                employeeId,
                departmentId: null,
                departmentName: null,
                allowedFeatures: allFeatures,
                permissionMatrix: fullMatrix,
                role: userRole,
                customRoles: [],
            }
        }

        const employee = await prisma.employee.findUnique({
            where: { employeeId },
            include: {
                department: true,
                customRoles: {
                    include: {
                        role: true,
                    },
                    where: {
                        role: {
                            isActive: true,
                        },
                    },
                },
            },
        })

        if (!employee) {
            return null
        }

        // Collect all permission matrices
        const matrices: PermissionMatrix[] = []

        // 1. Add department base permissions (Priority 0)
        if (employee.department?.allowedFeatures) {
            const deptMatrix = parsePermissionMatrix(employee.department.allowedFeatures)
            matrices.push(deptMatrix)
        }

        // 2. Add custom role permissions
        const sortedRoles = employee.customRoles
            .map(er => er.role)
        // No sorting by priority needed as we use additive permissions (UNION)

        const customRolesInfo = []

        for (const role of sortedRoles) {
            const roleMatrix = parsePermissionMatrix(role.allowedFeatures)
            matrices.push(roleMatrix)

            customRolesInfo.push({
                id: role.id,
                name: role.name,
                code: role.code,
                priority: role.priority,
                features: matrixToLegacyArray(roleMatrix),
                matrix: roleMatrix,
            })
        }

        // Merge all matrices
        const finalMatrix = mergePermissionMatrices(...matrices)

        return {
            employeeId: employee.employeeId,
            departmentId: employee.departmentId,
            departmentName: employee.department?.name || null,
            allowedFeatures: matrixToLegacyArray(finalMatrix),
            permissionMatrix: finalMatrix,
            role: userRole || null,
            customRoles: customRolesInfo,
        }
    } catch (error) {
        console.error('Error fetching employee permissions:', error)
        return null
    }
}

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/**
 * Check if an array of features includes a required feature
 */
export function hasPermission(features: string[], requiredFeature: string): boolean {
    return features.includes(requiredFeature)
}

/**
 * Check if employee has access to a specific feature
 */
export async function checkEmployeeFeatureAccess(
    employeeId: string,
    requiredFeature: string,
    userRole?: string,
    action: PermissionAction = 'read'
): Promise<boolean> {
    // ADMIN always has access
    if (userRole === 'ADMIN') {
        return true
    }

    const permissions = await getEmployeePermissions(employeeId, userRole)
    if (!permissions) {
        return false
    }

    return hasFeaturePermission(permissions.permissionMatrix, requiredFeature, action)
}

/**
 * Get all available features
 */
export function getAllFeatures(): string[] {
    return [
        'DASHBOARD',
        'ROLES',
        'NETWORK',
        'FTTH',
        'PAKET',
        'PELANGGAN',
        'INVENTORY',
        'USERS',
        'HELPDESK',
        'WORKORDERS',
        'HRIS',
        'FINANCE',
        'PENGATURAN'
    ]
}

// ============================================================================
// PERMISSION MATRIX HELPERS
// ============================================================================

/**
 * Create a full access permission matrix for given features
 */
export function createFullAccessMatrix(features: string[]): PermissionMatrix {
    const matrix: PermissionMatrix = {}
    features.forEach(f => {
        matrix[f] = { read: true, create: true, update: true, delete: true }
    })
    return matrix
}

/**
 * Create a read-only permission matrix for given features
 */
export function createReadOnlyMatrix(features: string[]): PermissionMatrix {
    const matrix: PermissionMatrix = {}
    features.forEach(f => {
        matrix[f] = { read: true, create: false, update: false, delete: false }
    })
    return matrix
}

/**
 * Serialize permission matrix to JSON string for storage
 */
export function serializePermissionMatrix(matrix: PermissionMatrix): string {
    return JSON.stringify(matrix)
}
