import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import { logger } from '@/lib/logger'

export interface DepartmentFilters {
    search?: string
    reminderOnly?: boolean
}

export interface CreateDepartmentData {
    name: string
    description?: string
    jobDescription?: string
    isReminderTarget?: boolean
    showInMobileWO?: boolean
}

export interface UpdateDepartmentData {
    name?: string
    description?: string
    jobDescription?: string
    isReminderTarget?: boolean
    showInMobileWO?: boolean
}

export interface ServiceResult<T> {
    success: boolean
    data?: T
    error?: string
    code?: string
}

export class DepartmentService {
    /**
     * Get all departments with filters
     */
    async getDepartments(filters: DepartmentFilters = {}): Promise<ServiceResult<unknown[]>> {
        try {
            const where: Prisma.DepartmentsWhereInput = {}

            if (filters.search) {
                where.OR = [
                    { name: { contains: filters.search, mode: 'insensitive' } },
                    { description: { contains: filters.search, mode: 'insensitive' } },
                ]
            }

            if (filters.reminderOnly) {
                where.isReminderTarget = true
            }

            const departments = await prisma.departments.findMany({
                where,
                include: {
                    _count: {
                        select: {
                            user: true,
                            work_orders: true,
                        },
                    },
                },
                orderBy: { name: 'asc' },
            })

            return { success: true, data: departments }
        } catch (error) {
            logger.error('DepartmentService.getDepartments failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Failed to fetch departments', code: 'FETCH_ERROR' }
        }
    }

    /**
     * Get single department by ID
     */
    async getDepartmentById(id: string): Promise<ServiceResult<unknown>> {
        try {
            const department = await prisma.departments.findUnique({
                where: { id },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            name: true,
                        },
                        take: 10,
                    },
                    _count: {
                        select: {
                            user: true,
                            work_orders: true,
                        },
                    },
                },
            })

            if (!department) {
                return { success: false, error: 'Department not found', code: 'NOT_FOUND' }
            }

            return { success: true, data: department }
        } catch (error) {
            logger.error('DepartmentService.getDepartmentById failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Failed to fetch department', code: 'FETCH_ERROR' }
        }
    }

    /**
     * Create new department
     */
    async createDepartment(data: CreateDepartmentData, createdById: string): Promise<ServiceResult<unknown>> {
        try {
            if (!data.name) {
                return { success: false, error: 'Name is required', code: 'VALIDATION_ERROR' }
            }

            // Check if name already exists
            const existing = await prisma.departments.findUnique({
                where: { name: data.name },
            })

            if (existing) {
                return { success: false, error: 'Department name already exists', code: 'DUPLICATE_NAME' }
            }

            const department = await prisma.departments.create({
                data: {
                    id: randomUUID(),
                    name: data.name,
                    description: data.description || null,
                    jobDescription: data.jobDescription || null,
                    isReminderTarget: data.isReminderTarget ?? false,
                    showInMobileWO: data.showInMobileWO ?? false,
                    updatedAt: new Date(),
                },
            })

            await this.logActivity('CREATE', 'Department', createdById, {
                id: department.id,
                name: department.name
            })

            return { success: true, data: department }
        } catch (error) {
            logger.error('DepartmentService.createDepartment failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Failed to create department', code: 'CREATE_ERROR' }
        }
    }

    /**
     * Update department
     */
    async updateDepartment(id: string, data: UpdateDepartmentData, updatedById: string): Promise<ServiceResult<unknown>> {
        try {
            const existing = await prisma.departments.findUnique({
                where: { id },
            })

            if (!existing) {
                return { success: false, error: 'Department not found', code: 'NOT_FOUND' }
            }

            // Check for duplicate name
            if (data.name && data.name !== existing.name) {
                const duplicate = await prisma.departments.findUnique({
                    where: { name: data.name },
                })

                if (duplicate) {
                    return { success: false, error: 'Department name already exists', code: 'DUPLICATE_NAME' }
                }
            }

            const department = await prisma.departments.update({
                where: { id },
                data: {
                    ...(data.name && { name: data.name }),
                    ...(data.description !== undefined && { description: data.description || null }),
                    ...(data.jobDescription !== undefined && { jobDescription: data.jobDescription || null }),
                    ...(data.isReminderTarget !== undefined && { isReminderTarget: data.isReminderTarget }),
                    ...(data.showInMobileWO !== undefined && { showInMobileWO: data.showInMobileWO }),
                },
            })

            await this.logActivity('UPDATE', 'Department', updatedById, {
                id: department.id,
                updates: data
            })

            return { success: true, data: department }
        } catch (error) {
            logger.error('DepartmentService.updateDepartment failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Failed to update department', code: 'UPDATE_ERROR' }
        }
    }

    /**
     * Delete department
     */
    async deleteDepartment(id: string, deletedById: string): Promise<ServiceResult<void>> {
        try {
            const department = await prisma.departments.findUnique({
                where: { id },
                include: {
                    _count: {
                        select: {
                            user: true,
                            work_orders: true,
                        },
                    },
                },
            })

            if (!department) {
                return { success: false, error: 'Department not found', code: 'NOT_FOUND' }
            }

            if (department._count.user > 0) {
                return {
                    success: false,
                    error: `Cannot delete department. It has ${department._count.user} user(s) assigned.`,
                    code: 'HAS_USERS'
                }
            }

            if (department._count.work_orders > 0) {
                return {
                    success: false,
                    error: `Cannot delete department. It has ${department._count.work_orders} work order(s) assigned.`,
                    code: 'HAS_WORKORDERS'
                }
            }

            await prisma.departments.delete({
                where: { id },
            })

            await this.logActivity('DELETE', 'Department', deletedById, {
                id: department.id,
                name: department.name
            })

            return { success: true }
        } catch (error) {
            logger.error('DepartmentService.deleteDepartment failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Failed to delete department', code: 'DELETE_ERROR' }
        }
    }

    private async logActivity(action: string, subject: string, userId: string, details: Record<string, unknown>): Promise<void> {
        try {
            await logger.logActivity({ action, subject, userId, details })
        } catch (e) {
            console.error('Logging failed', e)
        }
    }
}

// Singleton instance
let departmentServiceInstance: DepartmentService | null = null

export function getDepartmentService(): DepartmentService {
    if (!departmentServiceInstance) {
        departmentServiceInstance = new DepartmentService()
    }
    return departmentServiceInstance
}
