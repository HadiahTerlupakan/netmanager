import { SalaryRepository } from '../repositories/SalaryRepository'
import type { SalaryWithDetails, SalaryFilters } from '../repositories/SalaryRepository'
import { SalaryCalculatorService } from './SalaryCalculatorService'
import { SalaryAuditService } from './SalaryAuditService'
import { logger, logActivitySafe } from '@/lib/logger'
import { EmployeeType, Prisma } from '@prisma/client'
import type { Salary } from '@prisma/client'

// Standard ServiceResult pattern
export interface ServiceResult<T> {
    success: boolean
    data?: T
    error?: string
    code?: string
}

export interface SalaryListResult {
    salaries: SalaryWithDetails[]
    total: number
    page: number
    totalPages: number
    stats?: {
        total: number
        draft: number
        calculated: number
        audited: number
        approved: number
        paid: number
        totalNetSalary: number
    }
}

export class SalaryService {
    private repository: SalaryRepository
    private calculatorService: SalaryCalculatorService
    private auditService: SalaryAuditService

    constructor() {
        this.repository = new SalaryRepository()
        this.calculatorService = new SalaryCalculatorService()
        this.auditService = new SalaryAuditService()
    }

    /**
     * Get all salaries with filters and pagination
     */
    async getSalaries(
        filters: SalaryFilters,
        page: number = 1,
        limit: number = 50
    ): Promise<ServiceResult<SalaryListResult>> {
        try {
            const skip = (page - 1) * limit
            const { salaries, total } = await this.repository.findAll({
                ...filters,
                skip,
                take: limit
            })

            // Get period stats if month and year are specified
            let stats = undefined
            if (filters.month && filters.year) {
                stats = await this.repository.getPeriodStats(filters.month, filters.year)
            }

            return {
                success: true,
                data: {
                    salaries,
                    total,
                    page,
                    totalPages: Math.ceil(total / limit),
                    stats
                }
            }
        } catch (error) {
            logger.error('SalaryService.getSalaries failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Gagal mengambil data gaji', code: 'FETCH_ERROR' }
        }
    }

    /**
     * Get single salary by ID
     */
    async getSalaryById(id: string): Promise<ServiceResult<SalaryWithDetails>> {
        try {
            const salary = await this.repository.findById(id)
            if (!salary) {
                return { success: false, error: 'Gaji tidak ditemukan', code: 'NOT_FOUND' }
            }
            return { success: true, data: salary }
        } catch (error) {
            logger.error('SalaryService.getSalaryById failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Gagal mengambil gaji', code: 'FETCH_ERROR' }
        }
    }

    /**
     * Calculate salary for single user
     */
    async calculateSingle(
        userId: string,
        month: number,
        year: number,
        calculatedById: string
    ): Promise<ServiceResult<{ salaryId: string }>> {
        try {
            const salaryId = await this.calculatorService.calculateAndSave(userId, month, year)

            await this.logActivity('CREATE', 'Salary', calculatedById, {
                salaryId,
                userId,
                month,
                year,
                action: 'calculate-single'
            })

            return { success: true, data: { salaryId } }
        } catch (error) {
            logger.error('SalaryService.calculateSingle failed', error instanceof Error ? error : undefined)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Gagal menghitung gaji',
                code: 'CALCULATION_ERROR'
            }
        }
    }

    /**
     * Bulk calculate salaries
     */
    async calculateBulk(
        month: number,
        year: number,
        filters: { departmentId?: string; siteId?: string; employeeType?: EmployeeType },
        calculatedById: string
    ): Promise<ServiceResult<{ success: number; failed: Array<{ userId: string; error: string }> }>> {
        try {
            const result = await this.calculatorService.calculateBulk(month, year, filters)

            await this.logActivity('CREATE', 'Salary', calculatedById, {
                month,
                year,
                action: 'calculate-bulk',
                successCount: result.success,
                failedCount: result.failed.length,
                filters
            })

            return { success: true, data: result }
        } catch (error) {
            logger.error('SalaryService.calculateBulk failed', error instanceof Error ? error : undefined)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Gagal menghitung gaji massal',
                code: 'BULK_CALCULATION_ERROR'
            }
        }
    }

    /**
     * Approve salary
     */
    async approveSalary(
        id: string,
        approvedById: string,
        notes?: string
    ): Promise<ServiceResult<Salary>> {
        try {
            const existing = await this.repository.findById(id)
            if (!existing) {
                return { success: false, error: 'Gaji tidak ditemukan', code: 'NOT_FOUND' }
            }

            // Validate status transition
            if (existing.status !== 'AUDITED') {
                return {
                    success: false,
                    error: 'Gaji harus diaudit sebelum disetujui',
                    code: 'INVALID_STATUS'
                }
            }

            const salary = await this.repository.updateStatus(id, 'APPROVED', approvedById, notes)

            await this.logActivity('UPDATE', 'Salary', approvedById, {
                id,
                status: 'APPROVED',
                previousStatus: existing.status,
                notes
            })

            return { success: true, data: salary }
        } catch (error) {
            logger.error('SalaryService.approveSalary failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Gagal menyetujui gaji', code: 'APPROVE_ERROR' }
        }
    }

    /**
     * Mark salary as paid
     */
    async markAsPaid(
        id: string,
        paidById: string,
        notes?: string
    ): Promise<ServiceResult<Salary>> {
        try {
            const existing = await this.repository.findById(id)
            if (!existing) {
                return { success: false, error: 'Gaji tidak ditemukan', code: 'NOT_FOUND' }
            }

            if (existing.status !== 'APPROVED') {
                return {
                    success: false,
                    error: 'Gaji harus disetujui sebelum ditandai dibayar',
                    code: 'INVALID_STATUS'
                }
            }

            const salary = await this.repository.updateStatus(id, 'PAID', paidById, notes)

            await this.logActivity('UPDATE', 'Salary', paidById, {
                id,
                status: 'PAID',
                previousStatus: existing.status,
                notes
            })

            return { success: true, data: salary }
        } catch (error) {
            logger.error('SalaryService.markAsPaid failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Gagal menandai gaji sebagai dibayar', code: 'PAID_ERROR' }
        }
    }

    /**
     * Audit salary
     */
    async auditSalary(
        id: string,
        auditedById: string,
        notes?: string
    ): Promise<ServiceResult<Salary>> {
        try {
            const existing = await this.repository.findById(id)
            if (!existing) {
                return { success: false, error: 'Gaji tidak ditemukan', code: 'NOT_FOUND' }
            }

            if (existing.status !== 'CALCULATED') {
                return {
                    success: false,
                    error: 'Gaji harus dihitung sebelum diaudit',
                    code: 'INVALID_STATUS'
                }
            }

            const salary = await this.repository.updateStatus(id, 'AUDITED', auditedById, notes)

            await this.logActivity('UPDATE', 'Salary', auditedById, {
                id,
                status: 'AUDITED',
                previousStatus: existing.status,
                notes
            })

            return { success: true, data: salary }
        } catch (error) {
            logger.error('SalaryService.auditSalary failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Gagal mengaudit gaji', code: 'AUDIT_ERROR' }
        }
    }

    /**
     * Recalculate salary
     */
    async recalculateSalary(
        id: string,
        recalculatedById: string
    ): Promise<ServiceResult<{ salaryId: string }>> {
        try {
            const existing = await this.repository.findById(id)
            if (!existing) {
                return { success: false, error: 'Gaji tidak ditemukan', code: 'NOT_FOUND' }
            }

            // Only draft or calculated salaries can be recalculated
            if (!['DRAFT', 'CALCULATED'].includes(existing.status)) {
                return {
                    success: false,
                    error: 'Hanya gaji draft atau yang sudah dihitung yang dapat dihitung ulang',
                    code: 'INVALID_STATUS'
                }
            }

            // Clear existing details and recalculate
            await this.repository.clearDetails(id)
            const salaryId = await this.calculatorService.calculateAndSave(
                existing.userId,
                existing.month,
                existing.year
            )

            await this.logActivity('UPDATE', 'Salary', recalculatedById, {
                id,
                salaryId,
                action: 'recalculate',
                previousStatus: existing.status
            })

            return { success: true, data: { salaryId } }
        } catch (error) {
            logger.error('SalaryService.recalculateSalary failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Gagal menghitung ulang gaji', code: 'RECALCULATE_ERROR' }
        }
    }

    /**
     * Delete salary
     */
    async deleteSalary(
        id: string,
        deletedById: string
    ): Promise<ServiceResult<void>> {
        try {
            const existing = await this.repository.findById(id)
            if (!existing) {
                return { success: false, error: 'Gaji tidak ditemukan', code: 'NOT_FOUND' }
            }

            // Only draft salaries can be deleted
            if (existing.status !== 'DRAFT') {
                return {
                    success: false,
                    error: 'Hanya gaji draft yang dapat dihapus',
                    code: 'INVALID_STATUS'
                }
            }

            await this.repository.delete(id)

            await this.logActivity('DELETE', 'Salary', deletedById, {
                id,
                userId: existing.userId,
                month: existing.month,
                year: existing.year
            })

            return { success: true }
        } catch (error) {
            logger.error('SalaryService.deleteSalary failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Gagal menghapus gaji', code: 'DELETE_ERROR' }
        }
    }

    /**
     * Update salary (audit notes, etc)
     */
    async updateSalary(
        id: string,
        data: { auditNotes?: string },
        updatedById: string
    ): Promise<ServiceResult<Salary>> {
        try {
            const existing = await this.repository.findById(id)
            if (!existing) {
                return { success: false, error: 'Gaji tidak ditemukan', code: 'NOT_FOUND' }
            }

            // Only allow update if status is CALCULATED or REVISED
            if (!['CALCULATED', 'REVISED'].includes(existing.status)) {
                return {
                    success: false,
                    error: `Tidak dapat mengubah gaji dengan status: ${existing.status}`,
                    code: 'INVALID_STATUS'
                }
            }

            const updateData: Prisma.SalaryUpdateInput = {}
            if (data.auditNotes !== undefined) updateData.auditNotes = data.auditNotes

            const salary = await this.repository.update(id, updateData)

            await this.logActivity('UPDATE', 'Salary', updatedById, {
                id,
                updatedFields: Object.keys(updateData),
                previousStatus: existing.status
            })

            return { success: true, data: salary }
        } catch (error) {
            logger.error('SalaryService.updateSalary failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Gagal mengupdate gaji', code: 'UPDATE_ERROR' }
        }
    }

    /**
     * Add manual adjustment (earning/deduction)
     */
    async addAdjustment(
        id: string,
        adjustment: { name: string; type: 'EARNING' | 'DEDUCTION'; amount: number; notes: string },
        adjustedById: string
    ): Promise<ServiceResult<void>> {
        try {
            const existing = await this.repository.findById(id)
            if (!existing) {
                return { success: false, error: 'Gaji tidak ditemukan', code: 'NOT_FOUND' }
            }

            await this.auditService.addManualAdjustment(
                id,
                adjustment.name,
                adjustment.type,
                adjustment.amount,
                adjustment.notes,
                adjustedById
            )

            await this.logActivity('UPDATE', 'Salary', adjustedById, {
                id,
                action: 'add-adjustment',
                adjustment
            })

            return { success: true }
        } catch (error) {
            logger.error('SalaryService.addAdjustment failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Gagal menambah penyesuaian', code: 'ADJUSTMENT_ERROR' }
        }
    }

    /**
     * Request revision for salary
     */
    async requestRevision(
        id: string,
        requestedById: string,
        reason: string
    ): Promise<ServiceResult<void>> {
        try {
            const existing = await this.repository.findById(id)
            if (!existing) {
                return { success: false, error: 'Gaji tidak ditemukan', code: 'NOT_FOUND' }
            }

            await this.auditService.requestRevision(id, requestedById, reason)

            await this.logActivity('UPDATE', 'Salary', requestedById, {
                id,
                action: 'request-revision',
                reason
            })

            return { success: true }
        } catch (error) {
            logger.error('SalaryService.requestRevision failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Gagal meminta revisi', code: 'REVISION_ERROR' }
        }
    }

    /**
     * Helper: Log activity
     */
    private logActivity(
        action: string,
        subject: string,
        userId: string,
        details: Record<string, unknown>
    ): void {
        logActivitySafe({ action, subject, userId, details })
    }
}

// Singleton instance
let salaryServiceInstance: SalaryService | null = null

export function getSalaryService(): SalaryService {
    if (!salaryServiceInstance) {
        salaryServiceInstance = new SalaryService()
    }
    return salaryServiceInstance
}
