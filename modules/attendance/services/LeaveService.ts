import type { Prisma } from '@prisma/client'
import { LeaveRepository } from '../repositories/LeaveRepository'
import { LeaveBalanceRepository } from '../repositories/LeaveBalanceRepository'
import { HolidayRepository } from '../repositories/HolidayRepository'
import { AttendanceRepository } from '../repositories/AttendanceRepository'
import { UserRepository } from '@/modules/users'
import { calculateWorkingDays } from '../utils/calculateWorkingDays'
import { createNotification } from '@/modules/notification/services/NotificationService'
import { logger, logActivitySafe } from '@/lib/logger'
import { isPrismaRecordNotFoundError } from '@/lib/prisma-errors'
import type { LeaveStatus, LeaveType, AttendanceStatus } from '@prisma/client'
import { toStartOfDay, toEndOfDay } from '@/lib/utils/server-datetime'

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
    tenantId?: string
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
    private holidayRepository: HolidayRepository
    private attendanceRepository: AttendanceRepository
    private userRepository: UserRepository

    constructor() {
        this.repository = new LeaveRepository()
        this.balanceRepository = new LeaveBalanceRepository()
        this.holidayRepository = new HolidayRepository()
        this.attendanceRepository = new AttendanceRepository()
        this.userRepository = new UserRepository()
    }

    private async calculateWorkingDays(startDate: Date, endDate: Date, tenantId: string, workDaysStr: string | null = null): Promise<number> {
        return calculateWorkingDays(startDate, endDate, workDaysStr, this.holidayRepository, tenantId)
    }

    async getLeaves(
        filters: LeaveFilters,
        page: number = 1,
        limit: number = 20
    ): Promise<ServiceResult<{
        leaves: Array<Prisma.LeaveRequestGetPayload<{ include: { user: { select: { name: true; departments: { select: { name: true } }; sites: { select: { name: true } } } } } }>>
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
            return { success: false, error: 'Gagal mengambil data cuti', code: 'FETCH_ERROR' }
        }
    }

    async getLeaveById(id: string, tenantId: string): Promise<ServiceResult<Prisma.LeaveRequestGetPayload<{ include: { user: true } }>>> {
        try {
            const leave = await this.repository.findByIdWithUser(id, tenantId)
            if (!leave) {
                return { success: false, error: 'Cuti tidak ditemukan', code: 'NOT_FOUND' }
            }
            return { success: true, data: leave }
        } catch (error) {
            logger.error('LeaveService.getLeaveById failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Gagal mengambil cuti', code: 'FETCH_ERROR' }
        }
    }

    async createLeave(
        data: CreateLeaveData,
        createdById: string,
        tenantId: string,
        autoApprove: boolean = true
    ): Promise<ServiceResult<Prisma.LeaveRequestGetPayload<object>>> {
        try {
            let leaveDays = 0
            if (autoApprove) {
                const user = await this.userRepository.findWorkScheduleByIdWithTenant(data.userId, tenantId)

                if (user && user.workingHourMode !== 'FLEXIBLE' && data.type !== 'TUKAR_LIBUR') {
                    leaveDays = await this.calculateWorkingDays(data.startDate, data.endDate, tenantId, user.workDays)
                    const year = data.startDate.getFullYear()

                    const hasEnough = await this.balanceRepository.hasEnoughDays(data.userId, year, data.type, leaveDays, tenantId)
                    if (!hasEnough) {
                        return { success: false, error: 'Sisa cuti tidak mencukupi', code: 'INSUFFICIENT_BALANCE' }
                    }
                }
            }

            const leave = await this.repository.create({
                userId: data.userId,
                type: data.type,
                startDate: data.startDate,
                endDate: data.endDate,
                reason: data.reason,
                attachmentUrl: data.attachmentUrl ?? null,
                status: autoApprove ? 'APPROVED' : 'PENDING',
                approvedBy: autoApprove ? createdById : null,
                tenantId: tenantId
            })

            if (autoApprove && leaveDays > 0) {
                try {
                    const year = data.startDate.getFullYear()
                    await this.balanceRepository.incrementUsed(
                        data.userId,
                        year,
                        data.type as LeaveType,
                        leaveDays,
                        tenantId
                    )
                } catch (error) {
                    logger.error('Failed to update leave balance for auto-approved leave', error instanceof Error ? error : undefined)
                }
            }

            if (autoApprove) {
                try {
                    const leaveForSync = await this.repository.findByIdWithUser(leave.id, tenantId)
                    if (leaveForSync) {
                        await this.syncLeaveToAttendance(leaveForSync)
                    }
                } catch (error) {
                    logger.error('Failed to sync leave to attendance', error instanceof Error ? error : undefined)
                }
            }

            await this.logActivity('CREATE', 'LeaveRequest', createdById, {
                id: leave.id,
                userId: data.userId,
                type: data.type,
                autoApproved: autoApprove
            })

            return { success: true, data: leave }
        } catch (error) {
            logger.error('LeaveService.createLeave failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Gagal membuat cuti', code: 'CREATE_ERROR' }
        }
    }

    async syncApprovedLeaveToAttendanceRange(startDate: Date, endDate: Date, tenantId: string, userId?: string): Promise<void> {
        const leaves = await this.repository.findApprovedInRangeWithUser(startDate, endDate, tenantId, userId)

        for (const leave of leaves) {
            await this.syncLeaveToAttendance(leave)
        }
    }

    async approveLeave(
        id: string,
        approverId: string,
        tenantId: string
    ): Promise<ServiceResult<Prisma.LeaveRequestGetPayload<object>>> {
        try {
            const existing = await this.repository.findByIdWithUser(id, tenantId)

            if (!existing) {
                return { success: false, error: 'Cuti tidak ditemukan', code: 'NOT_FOUND' }
            }

            if (existing.status === 'APPROVED') {
                 return { success: false, error: 'Cuti sudah disetujui', code: 'ALREADY_APPROVED' }
            }

            let leaveDays = 0
            const shouldCheckBalance = existing.user.workingHourMode !== 'FLEXIBLE' && existing.type !== 'TUKAR_LIBUR'

            if (shouldCheckBalance) {
                leaveDays = await this.calculateWorkingDays(existing.startDate, existing.endDate, tenantId, existing.user.workDays)
                const year = existing.startDate.getFullYear()

                const hasEnough = await this.balanceRepository.hasEnoughDays(
                    existing.userId,
                    year,
                    existing.type as LeaveType,
                    leaveDays,
                    tenantId
                )

                if (!hasEnough) {
                    return { success: false, error: 'Sisa cuti tidak mencukupi', code: 'INSUFFICIENT_BALANCE' }
                }
            }

            const leave = await this.repository.update(id, {
                status: 'APPROVED',
                approvedBy: approverId
            })

            if (shouldCheckBalance && leaveDays > 0) {
                try {
                    const year = existing.startDate.getFullYear()
                    await this.balanceRepository.incrementUsed(
                        existing.userId,
                        year,
                        existing.type as LeaveType,
                        leaveDays,
                        tenantId
                    )
                } catch (error) {
                    logger.error('Failed to update leave balance', error instanceof Error ? error : undefined)
                }
            }

            try {
                await this.syncLeaveToAttendance(existing)
            } catch (error) {
                logger.error('Failed to sync leave to attendance in approve', error instanceof Error ? error : undefined)
            }

            await this.logActivity('UPDATE', 'LeaveRequest', approverId, {
                id,
                status: 'APPROVED',
                userId: existing.userId,
                employeeName: existing.user.name
            })

            await this.sendNotification(
                existing.userId,
                '✅ Izin Disetujui',
                'Pengajuan izin Anda telah disetujui.',
                leave.id
            )

            return { success: true, data: leave }
        } catch (error) {
            logger.error('LeaveService.approveLeave failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Gagal menyetujui cuti', code: 'APPROVE_ERROR' }
        }
    }

    async rejectLeave(
        id: string,
        approverId: string,
        tenantId: string,
        rejectionReason: string
    ): Promise<ServiceResult<Prisma.LeaveRequestGetPayload<object>>> {
        try {
            const existing = await this.repository.findByIdWithUser(id, tenantId)

            if (!existing) {
                return { success: false, error: 'Cuti tidak ditemukan', code: 'NOT_FOUND' }
            }

            if (existing.status === 'APPROVED') {
                if (existing.user.workingHourMode !== 'FLEXIBLE' && existing.type !== 'TUKAR_LIBUR') {
                     try {
                        const leaveDays = await this.calculateWorkingDays(existing.startDate, existing.endDate, tenantId, existing.user.workDays)
                        const year = existing.startDate.getFullYear()

                        await this.balanceRepository.decrementUsed(
                            existing.userId,
                            year,
                            existing.type as LeaveType,
                            leaveDays,
                            tenantId
                        )
                    } catch (error) {
                        logger.error('Failed to refund leave balance', error instanceof Error ? error : undefined)
                    }
                }

                try {
                    await this.revertLeaveFromAttendance(existing)
                } catch (error) {
                    logger.error('Failed to revert attendance in reject', error instanceof Error ? error : undefined)
                }
            }

            const leave = await this.repository.update(id, {
                status: 'REJECTED',
                rejectionReason
            })

            await this.logActivity('UPDATE', 'LeaveRequest', approverId, {
                id,
                status: 'REJECTED',
                rejectionReason,
                userId: existing.userId,
                employeeName: existing.user.name
            })

            await this.sendNotification(
                existing.userId,
                '❌ Izin Ditolak',
                `Pengajuan izin Anda ditolak. Alasan: ${rejectionReason}`,
                leave.id
            )

            return { success: true, data: leave }
        } catch (error) {
            logger.error('LeaveService.rejectLeave failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Gagal menolak cuti', code: 'REJECT_ERROR' }
        }
    }

    async deleteLeave(id: string, deletedById: string, tenantId: string): Promise<ServiceResult<void>> {
        try {
            const existing = await this.repository.findByIdWithUser(id, tenantId)

            if (!existing) {
                return { success: false, error: 'Cuti tidak ditemukan', code: 'NOT_FOUND' }
            }

            if (existing.status === 'APPROVED') {
                if (existing.user.workingHourMode !== 'FLEXIBLE' && existing.type !== 'TUKAR_LIBUR') {
                     try {
                        const leaveDays = await this.calculateWorkingDays(existing.startDate, existing.endDate, tenantId, existing.user.workDays)
                        const year = existing.startDate.getFullYear()

                        await this.balanceRepository.decrementUsed(
                            existing.userId,
                            year,
                            existing.type as LeaveType,
                            leaveDays,
                            tenantId
                        )
                    } catch (error) {
                        logger.error('Failed to refund leave balance during deletion', error instanceof Error ? error : undefined)
                    }
                }

                try {
                    await this.revertLeaveFromAttendance(existing)
                } catch (error) {
                    logger.error('Failed to revert attendance during deletion', error instanceof Error ? error : undefined)
                }
            }

            await this.repository.delete(id)

            await this.logActivity('DELETE', 'LeaveRequest', deletedById, {
                id,
                employeeName: existing.user?.name
            })

            return { success: true }
        } catch (error) {
            logger.error('LeaveService.deleteLeave failed', error instanceof Error ? error : undefined)
            if (isPrismaRecordNotFoundError(error)) {
                return { success: false, error: 'Cuti tidak ditemukan', code: 'NOT_FOUND' }
            }
            return { success: false, error: 'Gagal menghapus cuti', code: 'DELETE_ERROR' }
        }
    }

    private async syncLeaveToAttendance(leave: Prisma.LeaveRequestGetPayload<{ include: { user: true } }>): Promise<void> {
        const startDate = new Date(leave.startDate)
        const endDate = new Date(leave.endDate)
        const curDate = new Date(startDate)

        curDate.setTime(toStartOfDay(curDate).getTime())
        const lastDate = new Date(endDate)
        lastDate.setTime(toStartOfDay(lastDate).getTime())

        let status: AttendanceStatus = 'PERMIT'
        if (leave.type === 'SAKIT') status = 'SICK'
        else if (leave.type === 'TUKAR_LIBUR') status = 'DAY_OFF'
        else if (leave.type === 'CUTI') status = 'PERMIT'

        const workDaysStr = leave.user.workDays
        const defaultWorkDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
        const allowedDays = workDaysStr ? workDaysStr.split(',').map((d: string) => d.trim()) : defaultWorkDays
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

        while (curDate <= lastDate) {
            const dayIndex = curDate.getDay()
            const dayName = dayNames[dayIndex]

            if (allowedDays.includes(dayName)) {
                const { isHoliday } = await this.holidayRepository.isHoliday(curDate, leave.tenantId)
                if (!isHoliday) {
                    const dayStart = new Date(curDate)
                    dayStart.setTime(toStartOfDay(dayStart).getTime())
                    const dayEnd = new Date(curDate)
                    dayEnd.setTime(toEndOfDay(dayEnd).getTime())

                    const existingAttendance = await this.attendanceRepository.findFirst({
                        where: {
                            userId: leave.userId,
                            checkIn: {
                                gte: dayStart,
                                lte: dayEnd
                            },
                            tenantId: leave.tenantId
                        }
                    })

                    if (existingAttendance) {
                        const leaveMarker = `(${leave.type})`
                        const shouldUpdateLeaveMarker = !existingAttendance.notes?.includes(leaveMarker)
                        if (existingAttendance.status !== status || shouldUpdateLeaveMarker) {
                            await this.attendanceRepository.update(existingAttendance.id, {
                                status: status,
                                notes: existingAttendance.notes
                                    ? `${existingAttendance.notes} | Updated by Leave Approval (${leave.type})`
                                    : `Updated by Leave Approval (${leave.type})`
                            })
                        }
                    } else {
                        const checkInTime = new Date(curDate)
                        checkInTime.setTime(toStartOfDay(checkInTime).getTime())

                        await this.attendanceRepository.createWithId({
                            id: crypto.randomUUID(),
                            userId: leave.userId,
                            tenantId: leave.tenantId,
                            checkIn: checkInTime,
                            status: status,
                            notes: `Auto-generated from Leave Request (${leave.type})`,
                            location: 'System (Auto-Sync)',
                            updatedAt: new Date()
                        })
                    }
                }
            }
            curDate.setDate(curDate.getDate() + 1)
        }
    }

    private async revertLeaveFromAttendance(leave: Prisma.LeaveRequestGetPayload<{ include: { user: true } }>): Promise<void> {
        const startDate = new Date(leave.startDate)
        const endDate = new Date(leave.endDate)

        startDate.setTime(toStartOfDay(startDate).getTime())
        endDate.setTime(toEndOfDay(endDate).getTime())

        await this.attendanceRepository.deleteMany({
            userId: leave.userId,
            tenantId: leave.tenantId,
            checkIn: {
                gte: startDate,
                lte: endDate
            },
            status: {
                in: ['SICK', 'PERMIT', 'DAY_OFF']
            },
            notes: {
                contains: 'Leave'
            }
        })
    }

    private logActivity(
        action: string,
        subject: string,
        userId: string,
        details: Record<string, unknown>
    ): void {
        logActivitySafe({ action, subject, userId, details })
    }

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

let leaveServiceInstance: LeaveService | null = null

export function getLeaveService(): LeaveService {
    if (!leaveServiceInstance) {
        leaveServiceInstance = new LeaveService()
    }
    return leaveServiceInstance
}
