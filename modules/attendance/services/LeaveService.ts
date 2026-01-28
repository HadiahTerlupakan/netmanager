import { prisma } from '@/lib/prisma'
import { LeaveRepository } from '../repositories/LeaveRepository'
import { LeaveBalanceRepository } from '../repositories/LeaveBalanceRepository'
import { createNotification } from '@/modules/notification/services/NotificationService'
import { logger } from '@/lib/logger'
import { LeaveStatus, LeaveType } from '@prisma/client'

// Standard ServiceResult pattern
export interface ServiceResult<T> {
    success: boolean
    data?: T
    error?: string
    code?: string
}

export interface LeaveFilters {
    userId?: string
    status?: LeaveStatus
    startDate?: Date
    endDate?: Date
    departmentId?: string
    siteId?: string
}

export interface CreateLeaveData {
    userId: string
    type: LeaveType
    startDate: Date
    endDate: Date
    reason: string
    attachmentUrl?: string
}

export class LeaveService {
    private repository: LeaveRepository
    private balanceRepository: LeaveBalanceRepository

    constructor() {
        this.repository = new LeaveRepository()
        this.balanceRepository = new LeaveBalanceRepository()
    }

    /**
     * Get all leaves with filters and pagination
     */
    async getLeaves(
        filters: LeaveFilters,
        page: number = 1,
        limit: number = 20
    ): Promise<ServiceResult<{
        leaves: any[]
        total: number
        page: number
        totalPages: number
    }>> {
        try {
            const skip = (page - 1) * limit

            const [leaves, total] = await Promise.all([
                this.repository.findAll({ ...filters, skip, take: limit }),
                this.repository.count(filters)
            ])

            return {
                success: true,
                data: {
                    leaves,
                    total,
                    page,
                    totalPages: Math.ceil(total / limit)
                }
            }
        } catch (error) {
            logger.error('LeaveService.getLeaves failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Failed to fetch leaves', code: 'FETCH_ERROR' }
        }
    }

    /**
     * Get single leave by ID
     */
    async getLeaveById(id: string): Promise<ServiceResult<any>> {
        try {
            const leave = await this.repository.findById(id)
            if (!leave) {
                return { success: false, error: 'Leave not found', code: 'NOT_FOUND' }
            }
            return { success: true, data: leave }
        } catch (error) {
            logger.error('LeaveService.getLeaveById failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Failed to fetch leave', code: 'FETCH_ERROR' }
        }
    }

    /**
     * Create new leave request (admin manual entry)
     */
    async createLeave(
        data: CreateLeaveData,
        createdById: string,
        autoApprove: boolean = true
    ): Promise<ServiceResult<any>> {
        try {
            const leave = await this.repository.create({
                user: { connect: { id: data.userId } },
                type: data.type,
                startDate: data.startDate,
                endDate: data.endDate,
                reason: data.reason,
                attachmentUrl: data.attachmentUrl,
                status: autoApprove ? 'APPROVED' : 'PENDING',
                approvedBy: autoApprove ? createdById : undefined
            })

            // Log activity
            await this.logActivity('CREATE', 'LeaveRequest', createdById, {
                id: leave.id,
                userId: data.userId,
                type: data.type,
                autoApproved: autoApprove
            })

            return { success: true, data: leave }
        } catch (error) {
            logger.error('LeaveService.createLeave failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Failed to create leave', code: 'CREATE_ERROR' }
        }
    }

    /**
     * Approve leave request
     */
    async approveLeave(
        id: string,
        approverId: string
    ): Promise<ServiceResult<any>> {
        try {
            // Get existing leave with user data
            const existing = await prisma.leaveRequest.findUnique({
                where: { id },
                include: { user: true }
            })

            if (!existing) {
                return { success: false, error: 'Leave not found', code: 'NOT_FOUND' }
            }

            // Update status
            const leave = await this.repository.update(id, {
                status: 'APPROVED',
                approvedBy: approverId
            })

            // Update LeaveBalance (skip FLEXIBLE users and TUKAR_LIBUR)
            if (existing.user.workingHourMode !== 'FLEXIBLE' && existing.type !== 'TUKAR_LIBUR') {
                try {
                    const leaveDays = Math.ceil(
                        (existing.endDate.getTime() - existing.startDate.getTime()) / (1000 * 60 * 60 * 24)
                    ) + 1
                    const year = existing.startDate.getFullYear()

                    await this.balanceRepository.incrementUsed(
                        existing.userId,
                        year,
                        existing.type as LeaveType,
                        leaveDays
                    )
                } catch (error) {
                    logger.error('Failed to update leave balance', error instanceof Error ? error : undefined)
                    // Don't fail the approval just because balance update failed
                }
            }

            // Log activity
            await this.logActivity('UPDATE', 'LeaveRequest', approverId, {
                id,
                status: 'APPROVED',
                userId: existing.userId,
                employeeName: existing.user.name
            })

            // Send notification to user
            await this.sendNotification(
                existing.userId,
                '✅ Izin Disetujui',
                'Pengajuan izin Anda telah disetujui.',
                leave.id
            )

            return { success: true, data: leave }
        } catch (error) {
            logger.error('LeaveService.approveLeave failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Failed to approve leave', code: 'APPROVE_ERROR' }
        }
    }

    /**
     * Reject leave request
     */
    async rejectLeave(
        id: string,
        approverId: string,
        rejectionReason: string
    ): Promise<ServiceResult<any>> {
        try {
            const existing = await prisma.leaveRequest.findUnique({
                where: { id },
                include: { user: true }
            })

            if (!existing) {
                return { success: false, error: 'Leave not found', code: 'NOT_FOUND' }
            }

            const leave = await this.repository.update(id, {
                status: 'REJECTED',
                rejectionReason
            })

            // Log activity
            await this.logActivity('UPDATE', 'LeaveRequest', approverId, {
                id,
                status: 'REJECTED',
                rejectionReason,
                userId: existing.userId,
                employeeName: existing.user.name
            })

            // Send notification to user
            await this.sendNotification(
                existing.userId,
                '❌ Izin Ditolak',
                `Pengajuan izin Anda ditolak. Alasan: ${rejectionReason}`,
                leave.id
            )

            return { success: true, data: leave }
        } catch (error) {
            logger.error('LeaveService.rejectLeave failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Failed to reject leave', code: 'REJECT_ERROR' }
        }
    }

    /**
     * Delete leave request
     */
    async deleteLeave(id: string, deletedById: string): Promise<ServiceResult<void>> {
        try {
            const existing = await prisma.leaveRequest.findUnique({
                where: { id },
                include: { user: true }
            })

            if (!existing) {
                return { success: false, error: 'Leave not found', code: 'NOT_FOUND' }
            }

            await this.repository.delete(id)

            // Log activity
            await this.logActivity('DELETE', 'LeaveRequest', deletedById, {
                id,
                employeeName: existing.user?.name
            })

            return { success: true }
        } catch (error) {
            logger.error('LeaveService.deleteLeave failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Failed to delete leave', code: 'DELETE_ERROR' }
        }
    }

    /**
     * Helper: Log activity
     */
    private async logActivity(
        action: string,
        subject: string,
        userId: string,
        details: Record<string, any>
    ): Promise<void> {
        try {
            await logger.logActivity({ action, subject, userId, details })
        } catch (e) {
            console.error('Logging failed', e)
        }
    }

    /**
     * Helper: Send notification
     */
    private async sendNotification(
        userId: string,
        title: string,
        message: string,
        sourceId: string
    ): Promise<void> {
        try {
            await createNotification({
                type: 'SYSTEM',
                priority: 'NORMAL',
                title,
                message,
                link: '/karyawan/izin',
                userId,
                sourceType: 'LEAVE',
                sourceId
            })
        } catch (error) {
            console.error('Failed to notify user', error)
        }
    }
}

// Singleton instance
let leaveServiceInstance: LeaveService | null = null

export function getLeaveService(): LeaveService {
    if (!leaveServiceInstance) {
        leaveServiceInstance = new LeaveService()
    }
    return leaveServiceInstance
}
