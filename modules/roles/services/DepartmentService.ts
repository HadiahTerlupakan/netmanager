import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import { logger, logActivitySafe } from '@/lib/logger'
import { isPrismaRecordNotFoundError } from '@/lib/prisma-errors'
import { DepartmentRepository } from '../repositories/DepartmentRepository'

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
    description?: string | null
    jobDescription?: string | null
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
    private departmentRepo: DepartmentRepository

    constructor() {
        this.departmentRepo = new DepartmentRepository()
    }

    /**
     * Get all departments with filters
     */
    async getDepartments(filters: DepartmentFilters = {}): Promise<ServiceResult<unknown[]>> {
        try {
            const departments = await this.departmentRepo.findAll(filters)
            return { success: true, data: departments }
        } catch (error) {
            logger.error('DepartmentService.getDepartments failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Gagal mengambil daftar departemen', code: 'FETCH_ERROR' }
        }
    }

    /**
     * Get single department by ID
     */
    async getDepartmentById(id: string): Promise<ServiceResult<unknown>> {
        try {
            const department = await this.departmentRepo.findById(id)

            if (!department) {
                return { success: false, error: 'Departemen tidak ditemukan', code: 'NOT_FOUND' }
            }

            return { success: true, data: department }
        } catch (error) {
            logger.error('DepartmentService.getDepartmentById failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Gagal mengambil departemen', code: 'FETCH_ERROR' }
        }
    }

    /**
     * Create new department
     */
    async createDepartment(data: CreateDepartmentData, createdById: string): Promise<ServiceResult<unknown>> {
        try {
            if (!data.name) {
                return { success: false, error: 'Nama wajib diisi', code: 'VALIDATION_ERROR' }
            }

            // Check if name already exists
            const existing = await this.departmentRepo.findByName(data.name)

            if (existing) {
                return { success: false, error: 'Nama departemen sudah digunakan', code: 'DUPLICATE_NAME' }
            }

            const department = await this.departmentRepo.create({
                id: randomUUID(),
                name: data.name,
                description: data.description || null,
                jobDescription: data.jobDescription || null,
                isReminderTarget: data.isReminderTarget ?? false,
                showInMobileWO: data.showInMobileWO ?? false,
                updatedAt: new Date(),
            })

            await this.logActivity('CREATE', 'Department', createdById, {
                id: (department as { id: string }).id,
                name: (department as { name: string }).name
            })

            return { success: true, data: department }
        } catch (error) {
            logger.error('DepartmentService.createDepartment failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Gagal membuat departemen', code: 'CREATE_ERROR' }
        }
    }

    /**
     * Update department
     */
    async updateDepartment(id: string, data: UpdateDepartmentData, updatedById: string): Promise<ServiceResult<unknown>> {
        try {
            const existing = await this.departmentRepo.findById(id) as { id: string; name: string } | null

            if (!existing) {
                return { success: false, error: 'Departemen tidak ditemukan', code: 'NOT_FOUND' }
            }

            // Check for duplicate name
            if (data.name && data.name !== existing.name) {
                const duplicate = await this.departmentRepo.findByName(data.name);

                if (duplicate) {
                    return { success: false, error: 'Nama departemen sudah digunakan', code: 'DUPLICATE_NAME' }
                }
            }

            const department = await this.departmentRepo.update(id, data as Record<string, unknown>)

            await this.logActivity('UPDATE', 'Department', updatedById, {
                id: (department as { id: string }).id,
                updates: data
            })

            return { success: true, data: department }
        } catch (error) {
            logger.error('DepartmentService.updateDepartment failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Gagal mengupdate departemen', code: 'UPDATE_ERROR' }
        }
    }

    /**
     * Delete department
     */
    async deleteDepartment(id: string, deletedById: string): Promise<ServiceResult<void>> {
        try {
            const department = await this.departmentRepo.findByIdWithCounts(id)

            if (!department) {
                return { success: false, error: 'Departemen tidak ditemukan', code: 'NOT_FOUND' }
            }

            const userCount = department._count?.user ?? 0
            const workOrderCount = department._count?.work_orders ?? 0

            if (userCount > 0) {
                return {
                    success: false,
                    error: `Tidak dapat menghapus departemen. Terdapat ${userCount} pengguna yang terhubung.`,
                    code: 'HAS_USERS'
                }
            }

            if (workOrderCount > 0) {
                return {
                    success: false,
                    error: `Tidak dapat menghapus departemen. Terdapat ${workOrderCount} work order yang terhubung.`,
                    code: 'HAS_WORKORDERS'
                }
            }

            await this.departmentRepo.delete(id)

            await this.logActivity('DELETE', 'Department', deletedById, {
                id: id,
                name: (department as { name?: string }).name
            })

            return { success: true }
        } catch (error) {
            logger.error('DepartmentService.deleteDepartment failed', error instanceof Error ? error : undefined)
            if (isPrismaRecordNotFoundError(error)) {
                return { success: false, error: 'Departemen tidak ditemukan', code: 'NOT_FOUND' }
            }
            return { success: false, error: 'Gagal menghapus departemen', code: 'DELETE_ERROR' }
        }
    }

    private logActivity(action: string, subject: string, userId: string, details: Record<string, unknown>): void {
        logActivitySafe({ action, subject, userId, details })
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
