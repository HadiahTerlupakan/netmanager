import { RoleRepository } from '../repositories/RoleRepository'
import type { RoleWithCount, RoleWithPermissions, FilterOptions } from '../repositories/RoleRepository'
import type { Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

export class RoleService {
    private roleRepository: RoleRepository

    constructor() {
        this.roleRepository = new RoleRepository()
    }

    async getAllRoles(filter?: FilterOptions): Promise<RoleWithCount[]> {
        return this.roleRepository.findAll(filter)
    }

    async getRole(id: string): Promise<Role | null> {
        return this.roleRepository.findById(id)
    }

    async getRoleWithPermissions(id: string): Promise<RoleWithPermissions | null> {
        return this.roleRepository.findByIdWithPermissions(id)
    }

    async createRole(data: {
        name: string
        description?: string
        permissions: string[] // Array of "resource:action" strings
        accessAdminPanel?: boolean
        accessEmployeePanel?: boolean
        isRestricted?: boolean
        isTechnical?: boolean
    }): Promise<Role> {
        // Check if role already exists
        const existingRole = await this.roleRepository.findByName(data.name)
        if (existingRole) {
            throw new Error('Role with this name already exists')
        }

        // Deduplicate permissions
        const uniquePermissions = [...new Set(data.permissions)]

        // 1. Parse requested permissions
        const requestedPairs = uniquePermissions.map((p) => {
            const [resource, action] = p.split(':')
            return { resource, action }
        })

        if (requestedPairs.length > 0) {
            // 2. Find existing permissions to check what's missing
            const existingPermissions = await prisma.permission.findMany({
                where: {
                    OR: requestedPairs.map(pair => ({
                        resource: pair.resource,
                        action: pair.action
                    }))
                },
                select: {
                    resource: true,
                    action: true
                }
            })

            // 3. Identify missing permissions
            const missingPermissions = requestedPairs.filter(req =>
                !existingPermissions.some(exist =>
                    exist.resource === req.resource && exist.action === req.action
                )
            )

            // 4. Create missing permissions if any
            if (missingPermissions.length > 0) {
                await prisma.permission.createMany({
                    data: missingPermissions.map(p => ({
                        id: randomUUID(),
                        resource: p.resource,
                        action: p.action,
                        // Helper to capitalise first letter
                        name: `${p.action.charAt(0).toUpperCase() + p.action.slice(1)} ${p.resource.charAt(0).toUpperCase() + p.resource.slice(1)}`,
                        description: `Allow ${p.action} on ${p.resource}`,
                        updatedAt: new Date()
                    })),
                    skipDuplicates: true
                })
            }
        }

        // 5. Fetch ALL permission IDs (now that they all exist)
        const finalPermissions = await prisma.permission.findMany({
            where: {
                OR: requestedPairs.map(pair => ({
                    resource: pair.resource,
                    action: pair.action
                }))
            },
            select: { id: true }
        })

        return this.roleRepository.create({
            name: data.name,
            description: data.description,
            accessAdminPanel: data.accessAdminPanel,
            accessEmployeePanel: data.accessEmployeePanel,
            isRestricted: data.isRestricted,
            isTechnical: data.isTechnical,
            permissionIds: finalPermissions.map(p => p.id)
        })
    }

    async updateRole(id: string, data: {
        name: string
        description?: string
        permissions: string[] // Array of "resource:action" strings
        accessAdminPanel?: boolean
        accessEmployeePanel?: boolean
        isRestricted?: boolean
        isTechnical?: boolean
    }): Promise<Role> {
        // Check if role exists
        const currentRole = await this.roleRepository.findById(id)
        if (!currentRole) {
            throw new Error('Role not found')
        }

        // Don't allow renaming SUPER_ADMIN
        if (currentRole.name === 'SUPER_ADMIN' && data.name !== 'SUPER_ADMIN') {
            throw new Error('Cannot rename SUPER_ADMIN role')
        }

        // Deduplicate permissions
        const uniquePermissions = [...new Set(data.permissions)]

        // 1. Parse requested permissions
        const requestedPairs = uniquePermissions.map((p) => {
            const [resource, action] = p.split(':')
            return { resource, action }
        })

        if (requestedPairs.length > 0) {
            // 2. Find existing permissions to check what's missing
            const existingPermissions = await prisma.permission.findMany({
                where: {
                    OR: requestedPairs.map(pair => ({
                        resource: pair.resource,
                        action: pair.action
                    }))
                },
                select: {
                    resource: true,
                    action: true
                }
            })

            // 3. Identify missing permissions
            const missingPermissions = requestedPairs.filter(req =>
                !existingPermissions.some(exist =>
                    exist.resource === req.resource && exist.action === req.action
                )
            )

            // 4. Create missing permissions if any
            if (missingPermissions.length > 0) {
                await prisma.permission.createMany({
                    data: missingPermissions.map(p => ({
                        id: randomUUID(),
                        resource: p.resource,
                        action: p.action,
                        // Helper to capitalise first letter
                        name: `${p.action.charAt(0).toUpperCase() + p.action.slice(1)} ${p.resource.charAt(0).toUpperCase() + p.resource.slice(1)}`,
                        description: `Allow ${p.action} on ${p.resource}`,
                        updatedAt: new Date()
                    })),
                    skipDuplicates: true
                })
            }
        }

        // 5. Fetch ALL permission IDs (now that they all exist)
        const finalPermissions = await prisma.permission.findMany({
            where: {
                OR: requestedPairs.map(pair => ({
                    resource: pair.resource,
                    action: pair.action
                }))
            },
            select: { id: true }
        })

        return this.roleRepository.update(id, {
            name: data.name,
            description: data.description,
            accessAdminPanel: data.accessAdminPanel,
            accessEmployeePanel: data.accessEmployeePanel,
            isRestricted: data.isRestricted,
            isTechnical: data.isTechnical,
            permissionIds: finalPermissions.map(p => p.id)
        })
    }

    async deleteRole(id: string): Promise<Role> {
        // Check if role exists
        const currentRole = await this.roleRepository.findById(id)
        if (!currentRole) {
            throw new Error('Role not found')
        }

        // Don't allow deleting SUPER_ADMIN
        if (currentRole.name === 'SUPER_ADMIN') {
            throw new Error('Cannot delete SUPER_ADMIN role')
        }

        // Check if role has users
        const userCount = await this.roleRepository.countUsers(id)
        if (userCount > 0) {
            throw new Error('Cannot delete role that has assigned users')
        }

        return this.roleRepository.delete(id)
    }
}

// Singleton instance
let roleServiceInstance: RoleService | null = null

export function getRoleService(): RoleService {
    if (!roleServiceInstance) {
        roleServiceInstance = new RoleService()
    }
    return roleServiceInstance
}
