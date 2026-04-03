import { RoleRepository } from '../repositories/RoleRepository'
import type { RoleWithCount, RoleWithPermissions, FilterOptions } from '../repositories/RoleRepository'
import { PermissionRepository } from '../repositories/PermissionRepository'
import type { Role } from '@prisma/client'
import { randomUUID } from 'crypto'
import { invalidateRolePermissionCache } from '@/lib/auth'

export class RoleService {
    private roleRepository: RoleRepository
    private permissionRepository: PermissionRepository

    constructor() {
        this.roleRepository = new RoleRepository()
        this.permissionRepository = new PermissionRepository()
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
        isSuperAdmin?: boolean
        canApproveRab?: boolean
    }): Promise<Role> {
        // Check if role already exists
        const existingRole = await this.roleRepository.findByName(data.name)
        if (existingRole) {
            throw new Error('Role dengan nama ini sudah ada')
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
            const existingPermissions = await this.permissionRepository.findManyByResourceActionPairs(requestedPairs)

            // 3. Identify missing permissions
            const missingPermissions = requestedPairs.filter(req =>
                !existingPermissions.some(exist =>
                    exist.resource === req.resource && exist.action === req.action
                )
            )

            // 4. Create missing permissions if any
            if (missingPermissions.length > 0) {
                await this.permissionRepository.createMany(missingPermissions.map(p => ({
                    id: randomUUID(),
                    resource: p.resource,
                    action: p.action,
                    name: `${p.action.charAt(0).toUpperCase() + p.action.slice(1)} ${p.resource.charAt(0).toUpperCase() + p.resource.slice(1)}`,
                    description: `Izinkan ${p.action} pada ${p.resource}`,
                    updatedAt: new Date()
                })))
            }
        }

        // 5. Fetch ALL permission IDs (now that they all exist)
        const finalPermissions = await this.permissionRepository.findManyByResourceActionPairs(requestedPairs)

        return this.roleRepository.create({
            name: data.name,
            description: data.description,
            accessAdminPanel: data.accessAdminPanel,
            accessEmployeePanel: data.accessEmployeePanel,
            isRestricted: data.isRestricted,
            isTechnical: data.isTechnical,
            isSuperAdmin: data.isSuperAdmin,
            canApproveRab: data.canApproveRab,
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
        isSuperAdmin?: boolean
        canApproveRab?: boolean
    }): Promise<Role> {
        // Check if role exists
        const currentRole = await this.roleRepository.findById(id)
        if (!currentRole) {
            throw new Error('Role tidak ditemukan')
        }

        // Don't allow renaming SUPER_ADMIN
        if (currentRole.name === 'SUPER_ADMIN' && data.name !== 'SUPER_ADMIN') {
            throw new Error('Tidak dapat mengubah nama role SUPER_ADMIN')
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
            const existingPermissions = await this.permissionRepository.findManyByResourceActionPairs(requestedPairs)

            // 3. Identify missing permissions
            const missingPermissions = requestedPairs.filter(req =>
                !existingPermissions.some(exist =>
                    exist.resource === req.resource && exist.action === req.action
                )
            )

            // 4. Create missing permissions if any
            if (missingPermissions.length > 0) {
                await this.permissionRepository.createMany(missingPermissions.map(p => ({
                    id: randomUUID(),
                    resource: p.resource,
                    action: p.action,
                    name: `${p.action.charAt(0).toUpperCase() + p.action.slice(1)} ${p.resource.charAt(0).toUpperCase() + p.resource.slice(1)}`,
                    description: `Izinkan ${p.action} pada ${p.resource}`,
                    updatedAt: new Date()
                })))
            }
        }

        // 5. Fetch ALL permission IDs (now that they all exist)
        const finalPermissions = await this.permissionRepository.findManyByResourceActionPairs(requestedPairs)

        const updatedRole = await this.roleRepository.update(id, {
            name: data.name,
            description: data.description,
            accessAdminPanel: data.accessAdminPanel,
            accessEmployeePanel: data.accessEmployeePanel,
            isRestricted: data.isRestricted,
            isTechnical: data.isTechnical,
            isSuperAdmin: data.isSuperAdmin,
            canApproveRab: data.canApproveRab,
            permissionIds: finalPermissions.map(p => p.id)
        })

        // Invalidate permission cache for all users with this role
        // This ensures permission changes take effect immediately
        await invalidateRolePermissionCache(id)
        // console.log(`[RoleService] Permission cache invalidated for role: ${id}`)

        return updatedRole
    }

    async deleteRole(id: string): Promise<Role> {
        // Check if role exists
        const currentRole = await this.roleRepository.findById(id)
        if (!currentRole) {
            throw new Error('Role tidak ditemukan')
        }

        // Don't allow deleting SUPER_ADMIN
        if (currentRole.name === 'SUPER_ADMIN') {
            throw new Error('Tidak dapat menghapus role SUPER_ADMIN')
        }

        // Check if role has users
        const userCount = await this.roleRepository.countUsers(id)
        if (userCount > 0) {
            throw new Error('Tidak dapat menghapus role yang masih memiliki pengguna')
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
