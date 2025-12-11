import { prisma } from '@/lib/prisma'
import type { CustomRole, EmployeeRole } from '@prisma/client'
import type { PermissionMatrix } from '@/lib/types/permissions'
import { serializePermissionMatrix, convertLegacyToMatrix } from '@/lib/utils/permissions'

export interface CreateRoleInput {
    name: string
    code?: string // Auto-generate if not provided
    description?: string
    departmentId: string
    allowedFeatures?: string[] // Legacy: Array of feature codes (deprecated)
    permissionMatrix?: PermissionMatrix // New: Granular permissions
    priority?: number // Default 50
    createdBy: string
}

export interface UpdateRoleInput {
    name?: string
    description?: string
    allowedFeatures?: string[] // Legacy format
    permissionMatrix?: PermissionMatrix // New format
    priority?: number
    isActive?: boolean
}

export interface AssignRoleInput {
    employeeId: string
    roleId: string
    assignedBy: string
}

export class RoleRepository {
    /**
     * Generate unique role code from name
     */
    private generateRoleCode(name: string, departmentId: string): string {
        // Convert name to uppercase snake case
        const baseCode = name
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')

        // Add random suffix to ensure uniqueness
        const suffix = Math.random().toString(36).substring(2, 6).toUpperCase()
        return `${baseCode}_${suffix}`
    }

    /**
     * Create a new custom role
     */
    async create(input: CreateRoleInput): Promise<CustomRole> {
        // Generate code if not provided
        const code = input.code || this.generateRoleCode(input.name, input.departmentId)

        // Check if code already exists in this department
        const existing = await prisma.customRole.findFirst({
            where: {
                departmentId: input.departmentId,
                code: code,
            },
        })

        if (existing) {
            throw new Error(`Role code "${code}" already exists in this department`)
        }

        // Create the role
        // Determine the features to store: new matrix format preferred, fallback to legacy
        let featuresToStore: string
        if (input.permissionMatrix) {
            featuresToStore = serializePermissionMatrix(input.permissionMatrix)
        } else if (input.allowedFeatures) {
            // Convert legacy array to matrix format for storage
            featuresToStore = serializePermissionMatrix(convertLegacyToMatrix(input.allowedFeatures))
        } else {
            featuresToStore = '{}'
        }

        const role = await prisma.customRole.create({
            data: {
                name: input.name,
                code: code,
                description: input.description,
                departmentId: input.departmentId,
                allowedFeatures: featuresToStore,
                priority: 0, // Priority concept removed, default to 0
                createdBy: input.createdBy,
            },
            include: {
                department: true,
            },
        })

        return role
    }


    /**
     * Find all roles with optional filtering
     */
    async findAll(filters?: {
        departmentId?: string
        isActive?: boolean
        search?: string
    }) {
        const where: any = {}

        if (filters?.departmentId) {
            where.departmentId = filters.departmentId
        }

        if (filters?.isActive !== undefined) {
            where.isActive = filters.isActive
        }

        if (filters?.search) {
            where.OR = [
                { name: { contains: filters.search, mode: 'insensitive' } },
                { code: { contains: filters.search, mode: 'insensitive' } },
                { description: { contains: filters.search, mode: 'insensitive' } },
            ]
        }

        const roles = await prisma.customRole.findMany({
            where,
            include: {
                department: true,
                _count: {
                    select: {
                        employeeRoles: true,
                    },
                },
            },
            orderBy: [
                { department: { name: 'asc' } },
                { priority: 'desc' },
                { name: 'asc' },
            ],
        })

        return roles
    }

    /**
     * Find role by ID
     */
    async findById(id: string) {
        const role = await prisma.customRole.findUnique({
            where: { id },
            include: {
                department: true,
                employeeRoles: {
                    include: {
                        employee: {
                            select: {
                                id: true,
                                employeeId: true,
                                fullName: true,
                                email: true,
                                position: true,
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        employeeRoles: true,
                    },
                },
            },
        })

        return role
    }

    /**
     * Update a role
     */
    async update(id: string, input: UpdateRoleInput): Promise<CustomRole> {
        const updateData: any = {}

        if (input.name !== undefined) updateData.name = input.name
        if (input.description !== undefined) updateData.description = input.description
        if (input.isActive !== undefined) updateData.isActive = input.isActive

        // Priority concept removed - ignore input.priority
        // if (input.priority !== undefined) updateData.priority = input.priority

        // Handle permissions update - prefer new matrix format
        if (input.permissionMatrix !== undefined) {
            updateData.allowedFeatures = serializePermissionMatrix(input.permissionMatrix)
        } else if (input.allowedFeatures !== undefined) {
            // Convert legacy array to matrix format
            updateData.allowedFeatures = serializePermissionMatrix(
                convertLegacyToMatrix(input.allowedFeatures)
            )
        }


        const role = await prisma.customRole.update({
            where: { id },
            data: updateData,
            include: {
                department: true,
            },
        })

        return role
    }

    /**
     * Delete a role (only if no assignments)
     */
    async delete(id: string): Promise<void> {
        // Check for existing assignments
        const assignmentCount = await prisma.employeeRole.count({
            where: { roleId: id },
        })

        if (assignmentCount > 0) {
            throw new Error(
                `Cannot delete role: ${assignmentCount} employee(s) have this role assigned. ` +
                `Please remove all assignments first.`
            )
        }

        await prisma.customRole.delete({
            where: { id },
        })
    }

    /**
     * Assign role to employee
     */
    async assignToEmployee(input: AssignRoleInput): Promise<EmployeeRole> {
        // Check if employee exists
        const employee = await prisma.employee.findUnique({
            where: { id: input.employeeId },
            include: { department: true },
        })

        if (!employee) {
            throw new Error('Employee not found')
        }

        // Check if role exists
        const role = await prisma.customRole.findUnique({
            where: { id: input.roleId },
        })

        if (!role) {
            throw new Error('Role not found')
        }

        // Verify role belongs to employee's department
        if (employee.departmentId !== role.departmentId) {
            throw new Error(
                `Cannot assign this role: Role "${role.name}" belongs to a different department`
            )
        }

        // Check if already assigned
        const existing = await prisma.employeeRole.findUnique({
            where: {
                employeeId_roleId: {
                    employeeId: input.employeeId,
                    roleId: input.roleId,
                },
            },
        })

        if (existing) {
            throw new Error('Employee already has this role assigned')
        }

        // Assign the role
        const assignment = await prisma.employeeRole.create({
            data: {
                employeeId: input.employeeId,
                roleId: input.roleId,
                assignedBy: input.assignedBy,
            },
            include: {
                role: true,
                employee: {
                    select: {
                        employeeId: true,
                        fullName: true,
                    },
                },
            },
        })

        return assignment
    }

    /**
     * Remove role from employee
     */
    async unassignFromEmployee(employeeId: string, roleId: string): Promise<void> {
        const assignment = await prisma.employeeRole.findUnique({
            where: {
                employeeId_roleId: {
                    employeeId,
                    roleId,
                },
            },
        })

        if (!assignment) {
            throw new Error('Role assignment not found')
        }

        await prisma.employeeRole.delete({
            where: {
                id: assignment.id,
            },
        })
    }

    /**
     * Get all roles assigned to an employee
     */
    async getEmployeeRoles(employeeId: string) {
        const assignments = await prisma.employeeRole.findMany({
            where: { employeeId },
            include: {
                role: {
                    include: {
                        department: true,
                    },
                },
            },
            orderBy: {
                role: {
                    priority: 'desc',
                },
            },
        })

        return assignments
    }

    /**
     * Get all employees with a specific role
     */
    async getRoleAssignments(roleId: string) {
        const assignments = await prisma.employeeRole.findMany({
            where: { roleId },
            include: {
                employee: {
                    select: {
                        id: true,
                        employeeId: true,
                        fullName: true,
                        email: true,
                        position: true,
                        department: true,
                    },
                },
            },
            orderBy: {
                assignedAt: 'desc',
            },
        })

        return assignments
    }

    /**
     * Get role statistics
     */
    async getStats() {
        const totalRoles = await prisma.customRole.count()
        const activeRoles = await prisma.customRole.count({
            where: { isActive: true },
        })
        const totalAssignments = await prisma.employeeRole.count()

        const rolesByDepartment = await prisma.customRole.groupBy({
            by: ['departmentId'],
            _count: true,
        })

        return {
            totalRoles,
            activeRoles,
            inactiveRoles: totalRoles - activeRoles,
            totalAssignments,
            rolesByDepartment: rolesByDepartment.length,
        }
    }
}
