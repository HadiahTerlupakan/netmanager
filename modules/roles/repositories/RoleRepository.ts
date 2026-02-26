import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type { Role, Permission } from '@prisma/client'
import { randomUUID } from 'crypto'

export interface CreateRoleDTO {
    name: string
    description?: string
    accessAdminPanel?: boolean
    accessEmployeePanel?: boolean
    isRestricted?: boolean
    isTechnical?: boolean
    isSuperAdmin?: boolean
    canApproveRab?: boolean
    permissionIds?: string[]
}

export interface UpdateRoleDTO {
    name?: string
    description?: string
    accessAdminPanel?: boolean
    accessEmployeePanel?: boolean
    isRestricted?: boolean
    isTechnical?: boolean
    isSuperAdmin?: boolean
    canApproveRab?: boolean
    permissionIds?: string[]
}

export interface RoleWithPermissions extends Role {
    permissions: Permission[]
}

export interface RoleWithCount extends Role {
    _count: { user: number }
}

export interface FilterOptions {
    filterRestricted?: boolean
    currentUserRoleId?: string | null
    currentUserRoleName?: string | null
}

export class RoleRepository {
    async findAll(filter?: FilterOptions): Promise<RoleWithCount[]> {
        let whereClause: Prisma.RoleWhereInput = {}

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
                _count: { select: { user: true } }
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
        const role = await prisma.role.findUnique({
            where: { id },
            include: { permission: true }
        })

        if (!role) return null

        return {
            ...role,
            permissions: role.permission
        }
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
                id: randomUUID(),
                updatedAt: new Date(),
                name: data.name,
                description: data.description,
                accessAdminPanel: data.accessAdminPanel ?? false,
                accessEmployeePanel: data.accessEmployeePanel ?? false,
                isRestricted: data.isRestricted ?? false,
                isTechnical: data.isTechnical ?? false,
                isSuperAdmin: data.isSuperAdmin ?? false,
                canApproveRab: data.canApproveRab ?? false,
                permission: {
                    connect: permissionConnections
                }
            }
        })
    }

    async update(id: string, data: UpdateRoleDTO): Promise<Role> {
        const updateData: Prisma.RoleUpdateInput = {}

        if (data.name !== undefined) updateData.name = data.name
        if (data.description !== undefined) updateData.description = data.description
        if (data.accessAdminPanel !== undefined) updateData.accessAdminPanel = data.accessAdminPanel
        if (data.accessEmployeePanel !== undefined) updateData.accessEmployeePanel = data.accessEmployeePanel
        if (data.isRestricted !== undefined) updateData.isRestricted = data.isRestricted
        if (data.isTechnical !== undefined) updateData.isTechnical = data.isTechnical
        if (data.isSuperAdmin !== undefined) updateData.isSuperAdmin = data.isSuperAdmin
        if (data.canApproveRab !== undefined) updateData.canApproveRab = data.canApproveRab

        if (data.permissionIds !== undefined) {
            updateData.permission = {
                set: data.permissionIds.map(id => ({ id }))
            }
        }

        return prisma.role.update({
            where: { id },
            data: {
                ...updateData,
                updatedAt: new Date()
            }
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
            include: { _count: { select: { user: true } } }
        })
        return role?._count.user || 0
    }
}
