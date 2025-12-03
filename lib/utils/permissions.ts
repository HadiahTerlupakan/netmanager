import { prisma } from '@/lib/prisma'

export interface EmployeePermissions {
    employeeId: string
    departmentId: string | null
    departmentName: string | null
    allowedFeatures: string[]
    role: string | null
    customRoles?: Array<{
        id: string
        name: string
        code: string
        priority: number
        features: string[]
    }>
}

/**
 * Get employee permissions based on their department AND custom roles
 * ADMIN users get all features regardless of department/roles
 */
export async function getEmployeePermissions(
    employeeId: string,
    userRole?: string
): Promise<EmployeePermissions | null> {
    try {
        // If user is ADMIN, return all features
        if (userRole === 'ADMIN') {
            return {
                employeeId,
                departmentId: null,
                departmentName: null,
                allowedFeatures: [
                    'FINANCE',
                    'HRIS',
                    'PELANGGAN',
                    'FTTH',
                    'NETWORK',
                    'REPORTS',
                    'HELPDESK',
                    'WORKORDERS',
                ],
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

        // Start with a Set to avoid duplicates
        const permissionsSet = new Set<string>()

        // 1. Add department base permissions (Priority 0)
        if (employee.department?.allowedFeatures) {
            try {
                const deptFeatures = JSON.parse(employee.department.allowedFeatures)
                deptFeatures.forEach((f: string) => permissionsSet.add(f))
            } catch (e) {
                console.error('Error parsing department features:', e)
            }
        }

        // 2. Add custom role permissions (sorted by priority, highest first)
        const sortedRoles = employee.customRoles
            .map(er => er.role)
            .sort((a, b) => b.priority - a.priority)

        const customRolesInfo = []

        for (const role of sortedRoles) {
            const roleFeatures: string[] = []

            if (role.allowedFeatures) {
                try {
                    const features = JSON.parse(role.allowedFeatures)
                    features.forEach((f: string) => {
                        permissionsSet.add(f)
                        roleFeatures.push(f)
                    })
                } catch (e) {
                    console.error('Error parsing role features:', e)
                }
            }

            customRolesInfo.push({
                id: role.id,
                name: role.name,
                code: role.code,
                priority: role.priority,
                features: roleFeatures,
            })
        }

        return {
            employeeId: employee.employeeId,
            departmentId: employee.departmentId,
            departmentName: employee.department?.name || null,
            allowedFeatures: Array.from(permissionsSet),
            role: userRole || null,
            customRoles: customRolesInfo,
        }
    } catch (error) {
        console.error('Error fetching employee permissions:', error)
        return null
    }
}

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
    userRole?: string
): Promise<boolean> {
    // ADMIN always has access
    if (userRole === 'ADMIN') {
        return true
    }

    const permissions = await getEmployeePermissions(employeeId, userRole)
    if (!permissions) {
        return false
    }

    return hasPermission(permissions.allowedFeatures, requiredFeature)
}

/**
 * Filter navigation items based on allowed features
 */
export function filterNavigationByPermissions<T extends { feature?: string }>(
    navItems: T[],
    allowedFeatures: string[]
): T[] {
    return navItems.filter(item => {
        // If no feature requirement, always show
        if (!item.feature) {
            return true
        }
        // Check if feature is allowed
        return hasPermission(allowedFeatures, item.feature)
    })
}

/**
 * Get all available features
 */
export function getAllFeatures(): string[] {
    return [
        'FINANCE',
        'HRIS',
        'PELANGGAN',
        'FTTH',
        'NETWORK',
        'REPORTS',
        'HELPDESK',
        'WORKORDERS',
    ]
}
