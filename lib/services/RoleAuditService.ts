import { prisma } from '@/lib/prisma'
import type { RoleAuditLog } from '@prisma/client'

export interface AuditLogInput {
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ASSIGN' | 'UNASSIGN'
    entityType: 'ROLE' | 'ASSIGNMENT'
    entityId: string
    roleId?: string
    userId: string
    userName?: string
    oldValues?: any
    newValues?: any
    ipAddress?: string
    userAgent?: string
    notes?: string
}

export class RoleAuditService {
    /**
     * Create an audit log entry
     */
    async log(input: AuditLogInput): Promise<RoleAuditLog> {
        const log = await prisma.roleAuditLog.create({
            data: {
                action: input.action,
                entityType: input.entityType,
                entityId: input.entityId,
                roleId: input.roleId,
                userId: input.userId,
                userName: input.userName,
                oldValues: input.oldValues,
                newValues: input.newValues,
                ipAddress: input.ipAddress,
                userAgent: input.userAgent,
                notes: input.notes,
            },
        })

        return log
    }

    /**
     * Log role creation
     */
    async logRoleCreate(roleId: string, roleData: any, userId: string, userName?: string) {
        return this.log({
            action: 'CREATE',
            entityType: 'ROLE',
            entityId: roleId,
            roleId: roleId,
            userId,
            userName,
            newValues: roleData,
        })
    }

    /**
     * Log role update
     */
    async logRoleUpdate(
        roleId: string,
        oldData: any,
        newData: any,
        userId: string,
        userName?: string
    ) {
        return this.log({
            action: 'UPDATE',
            entityType: 'ROLE',
            entityId: roleId,
            roleId: roleId,
            userId,
            userName,
            oldValues: oldData,
            newValues: newData,
        })
    }

    /**
     * Log role deletion
     */
    async logRoleDelete(roleId: string, roleData: any, userId: string, userName?: string) {
        return this.log({
            action: 'DELETE',
            entityType: 'ROLE',
            entityId: roleId,
            roleId: roleId,
            userId,
            userName,
            oldValues: roleData,
        })
    }

    /**
     * Log role assignment to employee
     */
    async logRoleAssign(
        assignmentId: string,
        roleId: string,
        employeeId: string,
        assignedBy: string,
        assignedByName?: string
    ) {
        return this.log({
            action: 'ASSIGN',
            entityType: 'ASSIGNMENT',
            entityId: assignmentId,
            roleId: roleId,
            userId: assignedBy,
            userName: assignedByName,
            newValues: {
                employeeId,
                roleId,
            },
        })
    }

    /**
     * Log role removal from employee
     */
    async logRoleUnassign(
        assignmentId: string,
        roleId: string,
        employeeId: string,
        removedBy: string,
        removedByName?: string
    ) {
        return this.log({
            action: 'UNASSIGN',
            entityType: 'ASSIGNMENT',
            entityId: assignmentId,
            roleId: roleId,
            userId: removedBy,
            userName: removedByName,
            oldValues: {
                employeeId,
                roleId,
            },
        })
    }

    /**
     * Get audit logs with filtering
     */
    async findAll(filters?: {
        roleId?: string
        userId?: string
        action?: string
        entityType?: string
        startDate?: Date
        endDate?: Date
        limit?: number
        offset?: number
    }) {
        const where: any = {}

        if (filters?.roleId) where.roleId = filters.roleId
        if (filters?.userId) where.userId = filters.userId
        if (filters?.action) where.action = filters.action
        if (filters?.entityType) where.entityType = filters.entityType

        if (filters?.startDate || filters?.endDate) {
            where.createdAt = {}
            if (filters.startDate) where.createdAt.gte = filters.startDate
            if (filters.endDate) where.createdAt.lte = filters.endDate
        }

        const [logs, total] = await Promise.all([
            prisma.roleAuditLog.findMany({
                where,
                include: {
                    role: {
                        select: {
                            name: true,
                            code: true,
                            department: {
                                select: {
                                    name: true,
                                },
                            },
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
                take: filters?.limit || 50,
                skip: filters?.offset || 0,
            }),
            prisma.roleAuditLog.count({ where }),
        ])

        return { logs, total }
    }

    /**
     * Get audit logs for a specific role
     */
    async getRoleHistory(roleId: string, limit: number = 50) {
        const logs = await prisma.roleAuditLog.findMany({
            where: { roleId },
            orderBy: { createdAt: 'desc' },
            take: limit,
        })

        return logs
    }

    /**
     * Get recent audit activity
     */
    async getRecentActivity(limit: number = 20) {
        const logs = await prisma.roleAuditLog.findMany({
            include: {
                role: {
                    select: {
                        name: true,
                        code: true,
                        department: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        })

        return logs
    }

    /**
     * Get audit stats
     */
    async getStats(filters?: { startDate?: Date; endDate?: Date }) {
        const where: any = {}

        if (filters?.startDate || filters?.endDate) {
            where.createdAt = {}
            if (filters.startDate) where.createdAt.gte = filters.startDate
            if (filters.endDate) where.createdAt.lte = filters.endDate
        }

        const [totalLogs, byAction] = await Promise.all([
            prisma.roleAuditLog.count({ where }),
            prisma.roleAuditLog.groupBy({
                by: ['action'],
                where,
                _count: true,
            }),
        ])

        return {
            totalLogs,
            byAction: byAction.reduce((acc, item) => {
                acc[item.action] = item._count
                return acc
            }, {} as Record<string, number>),
        }
    }
}
