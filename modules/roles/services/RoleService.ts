import { RoleRepository } from '../repositories/RoleRepository'
import type { RoleWithCount, RoleWithPermissions, FilterOptions } from '../repositories/RoleRepository'
import { PermissionRepository } from '../repositories/PermissionRepository'
import type { Role } from '@prisma/client'
import { randomUUID } from 'crypto'
import { invalidateRolePermissionCache } from '@/lib/auth'
import { sanitizePermissionsByPanelAccess } from '@/lib/permission-sanitizer'
import { isMainTenant } from '@/modules/mitra'

const RESTRICTED_SENSITIVE_RESOURCES = new Set(['backup_database', 'app_version', 'tenants'])
const SENSITIVE_PERMISSION_MESSAGE =
    'Hanya tenant utama yang dapat memberikan hak akses administratif sensitif (Backup, App Version, Tenants)'
const SUPER_ADMIN_CREATE_MESSAGE = 'Hanya tenant utama yang dapat membuat role Super Admin'
const SUPER_ADMIN_UPDATE_MESSAGE = 'Hanya tenant utama yang dapat mengelola role Super Admin'

export class RolePolicyError extends Error {
    public readonly status: number

    constructor(message: string, status = 403) {
        super(message)
        this.status = status
        Object.setPrototypeOf(this, RolePolicyError.prototype)
    }
}

type RoleMutationInput = {
    name: string
    description?: string
    permissions: string[]
    accessAdminPanel?: boolean
    accessEmployeePanel?: boolean
    isRestricted?: boolean
    isTechnical?: boolean
    isSuperAdmin?: boolean
    canApproveRab?: boolean
}

type RoleMutationContext = {
    tenantId?: string | null
}

export class RoleService {
    private roleRepository: RoleRepository
    private permissionRepository: PermissionRepository

    constructor() {
        this.roleRepository = new RoleRepository()
        this.permissionRepository = new PermissionRepository()
    }

    async getCurrentUserRoleContext(userId?: string | null): Promise<{ roleId: string | null, roleName: string | null }> {
        return this.roleRepository.findUserRoleContext(userId ?? null)
    }

    async getAllRoles(filter?: FilterOptions): Promise<RoleWithCount[]> {
        return this.roleRepository.findAll(filter)
    }

    async getRolesForHakAkses(filterRestricted?: boolean, currentUserId?: string | null): Promise<RoleWithCount[]> {
        if (!filterRestricted) {
            return this.getAllRoles()
        }

        const currentUserRoleContext = await this.getCurrentUserRoleContext(currentUserId ?? null)

        return this.getAllRoles({
            filterRestricted: true,
            currentUserRoleId: currentUserRoleContext.roleId,
            currentUserRoleName: currentUserRoleContext.roleName
        })
    }

    async getRole(id: string): Promise<Role | null> {
        return this.roleRepository.findById(id)
    }

    async getRoleWithPermissions(id: string): Promise<RoleWithPermissions | null> {
        return this.roleRepository.findByIdWithPermissions(id)
    }

    async createRoleWithPolicy(input: RoleMutationInput, context?: RoleMutationContext): Promise<Role> {
        const sanitizedPermissions = await this.sanitizePermissions(input)

        this.ensureSuperAdminAllowed(Boolean(input.isSuperAdmin), SUPER_ADMIN_CREATE_MESSAGE, context?.tenantId)
        this.ensureSensitivePermissionsAllowed(sanitizedPermissions, context?.tenantId)

        const payload = this.buildRolePayload(input, sanitizedPermissions)

        return this.createRole(payload)
    }

    async updateRoleWithPolicy(id: string, input: RoleMutationInput, context?: RoleMutationContext): Promise<Role> {
        const sanitizedPermissions = await this.sanitizePermissions(input)

        this.ensureSuperAdminAllowed(Boolean(input.isSuperAdmin), SUPER_ADMIN_UPDATE_MESSAGE, context?.tenantId)
        this.ensureSensitivePermissionsAllowed(sanitizedPermissions, context?.tenantId)

        const payload = this.buildRolePayload(input, sanitizedPermissions)

        return this.updateRole(id, payload)
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

    private async sanitizePermissions(input: RoleMutationInput): Promise<string[]> {
        return sanitizePermissionsByPanelAccess(
            input.permissions,
            input.accessAdminPanel ?? false,
            input.accessEmployeePanel ?? false
        )
    }

    private ensureSuperAdminAllowed(isSuperAdmin: boolean, message: string, tenantId?: string | null) {
        if (!isSuperAdmin) {
            return
        }

        if (!isMainTenant(tenantId ?? null)) {
            throw new RolePolicyError(message)
        }
    }

    private ensureSensitivePermissionsAllowed(permissions: string[], tenantId?: string | null) {
        if (isMainTenant(tenantId ?? null)) {
            return
        }

        const hasRestricted = permissions.some((permission) => {
            const [resource] = permission.split(':')
            return RESTRICTED_SENSITIVE_RESOURCES.has(resource)
        })

        if (hasRestricted) {
            throw new RolePolicyError(SENSITIVE_PERMISSION_MESSAGE)
        }
    }

    private buildRolePayload(input: RoleMutationInput, permissions: string[]) {
        const payload: {
            name: string
            permissions: string[]
            description?: string
            accessAdminPanel?: boolean
            accessEmployeePanel?: boolean
            isRestricted?: boolean
            isTechnical?: boolean
            isSuperAdmin?: boolean
            canApproveRab?: boolean
        } = {
            name: input.name,
            permissions
        }

        if (input.description !== undefined) payload.description = input.description
        if (input.accessAdminPanel !== undefined) payload.accessAdminPanel = input.accessAdminPanel
        if (input.accessEmployeePanel !== undefined) payload.accessEmployeePanel = input.accessEmployeePanel
        if (input.isRestricted !== undefined) payload.isRestricted = input.isRestricted
        if (input.isTechnical !== undefined) payload.isTechnical = input.isTechnical
        if (input.isSuperAdmin !== undefined) payload.isSuperAdmin = input.isSuperAdmin
        if (input.canApproveRab !== undefined) payload.canApproveRab = input.canApproveRab

        return payload
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
