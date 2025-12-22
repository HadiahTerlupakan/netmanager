import { prisma } from '@/lib/prisma'
import type { Role, Permission } from '@prisma/client'

export interface CreateRoleDTO {
    name: string
    description?: string
    accessAdminPanel?: boolean
    accessEmployeePanel?: boolean
    isRestricted?: boolean
    permissionIds?: string[]
}

export interface UpdateRoleDTO {
    name?: string
    description?: string
    accessAdminPanel?: boolean
    accessEmployeePanel?: boolean
    isRestricted?: boolean
    permissionIds?: string[]
}

export interface RoleWithPermissions extends Role {
    permissions: Permission[]
}

export interface RoleWithCount extends Role {
    _count: { users: number }
}

export interface FilterOptions {
    filterRestricted?: boolean
    currentUserRoleId?: string | null
    currentUserRoleName?: string | null
}

export class RoleRepository {
    async findAll(filter?: FilterOptions): Promise<RoleWithCount[]> {
        let whereClause: any = {}

        if (filter?.filterRestricted) {
            // Only SUPER_ADMIN can see all roles including restricted ones
            if (filter.currentUserRoleName !== 'SUPER_ADMIN') {
                whereClause = {
                    OR: [
                        { isRestricted: false },
                        { id: filter.currentUserRoleId || '' }
                    ]
                }
            }
        }

        return prisma.role.findMany({
            where: whereClause,
            include: {
                _count: { select: { users: true } }
            },
            orderBy: { createdAt: 'desc' }
        })
    }

    async findById(id: string): Promise<Role | null> {
        return prisma.role.findUnique({
            where: { id }
        })
    }

    async findByIdWithPermissions(id: string): Promise<RoleWithPermissions | null> {
        return prisma.role.findUnique({
            where: { id },
            include: { permissions: true }
        })
    }

    async findByName(name: string): Promise<Role | null> {
        return prisma.role.findUnique({
            where: { name }
        })
    }

    async create(data: CreateRoleDTO): Promise<Role> {
        const permissionConnections = data.permissionIds?.map(id => ({ id })) || []

        return prisma.role.create({
            data: {
                name: data.name,
                description: data.description,
                accessAdminPanel: data.accessAdminPanel ?? false,
                accessEmployeePanel: data.accessEmployeePanel ?? false,
                isRestricted: data.isRestricted ?? false,
                permissions: {
                    connect: permissionConnections
                }
            }
        })
    }

    async update(id: string, data: UpdateRoleDTO): Promise<Role> {
        const updateData: any = {}

        if (data.name !== undefined) updateData.name = data.name
        if (data.description !== undefined) updateData.description = data.description
        if (data.accessAdminPanel !== undefined) updateData.accessAdminPanel = data.accessAdminPanel
        if (data.accessEmployeePanel !== undefined) updateData.accessEmployeePanel = data.accessEmployeePanel
        if (data.isRestricted !== undefined) updateData.isRestricted = data.isRestricted

        if (data.permissionIds !== undefined) {
            updateData.permissions = {
                set: data.permissionIds.map(id => ({ id }))
            }
        }

        return prisma.role.update({
            where: { id },
            data: updateData
        })
    }

    async delete(id: string): Promise<Role> {
        return prisma.role.delete({
            where: { id }
        })
    }

    async countUsers(id: string): Promise<number> {
        const role = await prisma.role.findUnique({
            where: { id },
            include: { _count: { select: { users: true } } }
        })
        return role?._count.users || 0
    }
}
