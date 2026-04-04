import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LeaveService } from '@/modules/attendance/services/LeaveService'
import { LeaveType } from '@prisma/client'

// Mock repositories
const mockLeaveRepo = {
    findAll: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findUnique: vi.fn(),
    findById: vi.fn(),
    findByIdWithUser: vi.fn(),
    findApprovedInRangeWithUser: vi.fn(),
}

const mockBalanceRepo = {
    incrementUsed: vi.fn(),
    decrementUsed: vi.fn(),
    hasEnoughDays: vi.fn(),
    getBalance: vi.fn(),
}

const mockHolidayRepo = {
    isHoliday: vi.fn().mockResolvedValue({ isHoliday: false }),
}

const mockUserRepo = {
    findWorkScheduleByIdWithTenant: vi.fn(),
}

// Mock Repository Classes
vi.mock('@/modules/attendance/repositories/LeaveRepository', () => ({
    LeaveRepository: class {
        constructor() {
            Object.assign(this, mockLeaveRepo)
        }
    }
}))

vi.mock('@/modules/attendance/repositories/LeaveBalanceRepository', () => ({
    LeaveBalanceRepository: class {
        constructor() {
            Object.assign(this, mockBalanceRepo)
        }
    }
}))

vi.mock('@/modules/attendance/repositories/HolidayRepository', () => ({
    HolidayRepository: class {
        constructor() {
            Object.assign(this, mockHolidayRepo)
        }
    }
}))

vi.mock('@/modules/users/repositories/UserRepository', () => ({
    UserRepository: class {
        constructor() {
            Object.assign(this, mockUserRepo)
        }
    }
}))

vi.mock('@/modules/notification/services/NotificationService', () => ({
    createNotification: vi.fn()
}))

vi.mock('@/lib/logger', () => ({
    logger: {
        logActivity: vi.fn(),
        error: vi.fn(),
        info: vi.fn()
    },
    logActivitySafe: vi.fn()
}))

describe('LeaveService', () => {
    let service: LeaveService
    const tenantId = 'tenant-1'

    beforeEach(() => {
        vi.clearAllMocks()
        service = new LeaveService()
        // Reset default mock behaviors
        mockHolidayRepo.isHoliday.mockResolvedValue({ isHoliday: false })
        mockBalanceRepo.hasEnoughDays.mockResolvedValue(true)
        mockUserRepo.findWorkScheduleByIdWithTenant.mockResolvedValue({
            id: 'user-1',
            workingHourMode: 'FIXED',
            workDays: 'Mon,Tue,Wed,Thu,Fri',
            tenantId,
        })
    })

    describe('createLeave', () => {
        const createData = {
            userId: 'user-1',
            type: 'CUTI' as LeaveType,
            startDate: new Date('2024-01-01'), // Monday
            endDate: new Date('2024-01-02'),   // Tuesday
            reason: 'Vacation'
        }

        it('should create pending leave without deducting balance if autoApprove is false', async () => {
            mockLeaveRepo.create.mockResolvedValue({ id: 'leave-1', ...createData, status: 'PENDING', tenantId })

            const result = await service.createLeave(createData, 'admin-1', tenantId, false)

            expect(result.success).toBe(true)
            expect(mockLeaveRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                status: 'PENDING',
                tenantId
            }))
            expect(mockBalanceRepo.incrementUsed).not.toHaveBeenCalled()
        })

        it('should create approved leave and deduct balance if autoApprove is true', async () => {
            // Mock user to have fixed schedule
            mockUserRepo.findWorkScheduleByIdWithTenant.mockResolvedValue({
                id: 'user-1',
                workingHourMode: 'FIXED',
                workDays: 'Mon,Tue,Wed,Thu,Fri',
                tenantId,
            })

            mockLeaveRepo.create.mockResolvedValue({ id: 'leave-1', ...createData, status: 'APPROVED', tenantId })

            const result = await service.createLeave(createData, 'admin-1', tenantId, true)

            expect(result.success).toBe(true)
            expect(mockLeaveRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                status: 'APPROVED',
                tenantId
            }))
            // 2 days (Mon, Tue)
            expect(mockBalanceRepo.incrementUsed).toHaveBeenCalledWith('user-1', 2024, 'CUTI', 2, tenantId)
        })

        it('should fail if balance is insufficient for auto-approved leave', async () => {
            mockUserRepo.findWorkScheduleByIdWithTenant.mockResolvedValue({
                id: 'user-1',
                workingHourMode: 'FIXED',
                workDays: 'Mon,Tue,Wed,Thu,Fri',
                tenantId,
            })

            mockBalanceRepo.hasEnoughDays.mockResolvedValue(false)

            const result = await service.createLeave(createData, 'admin-1', tenantId, true)

            expect(result.success).toBe(false)
            expect(result.code).toBe('INSUFFICIENT_BALANCE')
            expect(mockLeaveRepo.create).not.toHaveBeenCalled()
        })
    })

    describe('approveLeave', () => {
        const leaveRequest = {
            id: 'leave-1',
            userId: 'user-1',
            type: 'CUTI',
            startDate: new Date('2024-01-01'), // Monday
            endDate: new Date('2024-01-03'),   // Wednesday (3 days)
            status: 'PENDING',
            tenantId,
            user: {
                id: 'user-1',
                name: 'John Doe',
                workingHourMode: 'FIXED',
                workDays: 'Mon,Tue,Wed,Thu,Fri',
                tenantId
            }
        }

        it('should approve leave and deduct balance', async () => {
            mockLeaveRepo.findByIdWithUser.mockResolvedValue(leaveRequest)
            mockLeaveRepo.update.mockResolvedValue({ ...leaveRequest, status: 'APPROVED' })

            const result = await service.approveLeave('leave-1', 'admin-1', tenantId)

            expect(result.success).toBe(true)
            expect(mockBalanceRepo.incrementUsed).toHaveBeenCalledWith('user-1', 2024, 'CUTI', 3, tenantId)
            expect(mockLeaveRepo.update).toHaveBeenCalledWith('leave-1', expect.objectContaining({
                status: 'APPROVED'
            }))
        })

        it('should fail approval if balance is insufficient', async () => {
            mockLeaveRepo.findByIdWithUser.mockResolvedValue(leaveRequest)
            mockBalanceRepo.hasEnoughDays.mockResolvedValue(false)

            const result = await service.approveLeave('leave-1', 'admin-1', tenantId)

            expect(result.success).toBe(false)
            expect(result.code).toBe('INSUFFICIENT_BALANCE')
            expect(mockLeaveRepo.update).not.toHaveBeenCalled()
        })

        it('should not deduct balance for FLEXIBLE users', async () => {
            const flexUserLeave = {
                ...leaveRequest,
                user: { ...leaveRequest.user, workingHourMode: 'FLEXIBLE' }
            }
            mockLeaveRepo.findByIdWithUser.mockResolvedValue(flexUserLeave)
            mockLeaveRepo.update.mockResolvedValue({ ...flexUserLeave, status: 'APPROVED' })

            const result = await service.approveLeave('leave-1', 'admin-1', tenantId)

            expect(result.success).toBe(true)
            expect(mockBalanceRepo.incrementUsed).not.toHaveBeenCalled()
        })
    })

    describe('rejectLeave', () => {
        const approvedLeave = {
            id: 'leave-1',
            userId: 'user-1',
            type: 'CUTI',
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-01-01'), // 1 day
            status: 'APPROVED',
            tenantId,
            user: {
                id: 'user-1',
                workingHourMode: 'FIXED',
                workDays: 'Mon,Tue,Wed,Thu,Fri',
                tenantId
            }
        }

        it('should refund balance when rejecting approved leave', async () => {
            mockLeaveRepo.findByIdWithUser.mockResolvedValue(approvedLeave)
            mockLeaveRepo.update.mockResolvedValue({ ...approvedLeave, status: 'REJECTED' })

            const result = await service.rejectLeave('leave-1', 'admin-1', tenantId, 'Reason')

            expect(result.success).toBe(true)
            expect(mockBalanceRepo.decrementUsed).toHaveBeenCalledWith('user-1', 2024, 'CUTI', 1, tenantId)
        })

        it('should NOT refund balance when rejecting pending leave', async () => {
            const pendingLeave = { ...approvedLeave, status: 'PENDING' }
            mockLeaveRepo.findByIdWithUser.mockResolvedValue(pendingLeave)
            mockLeaveRepo.update.mockResolvedValue({ ...pendingLeave, status: 'REJECTED' })

            const result = await service.rejectLeave('leave-1', 'admin-1', tenantId, 'Reason')

            expect(result.success).toBe(true)
            expect(mockBalanceRepo.decrementUsed).not.toHaveBeenCalled()
        })
    })

    describe('deleteLeave', () => {
        const approvedLeave = {
            id: 'leave-1',
            userId: 'user-1',
            type: 'CUTI',
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-01-01'), // 1 day
            status: 'APPROVED',
            tenantId,
            user: {
                id: 'user-1',
                workingHourMode: 'FIXED',
                workDays: 'Mon,Tue,Wed,Thu,Fri',
                tenantId
            }
        }

        it('should refund balance when deleting approved leave', async () => {
            mockLeaveRepo.findByIdWithUser.mockResolvedValue(approvedLeave)

            const result = await service.deleteLeave('leave-1', 'admin-1', tenantId)

            expect(result.success).toBe(true)
            expect(mockBalanceRepo.decrementUsed).toHaveBeenCalledWith('user-1', 2024, 'CUTI', 1, tenantId)
            expect(mockLeaveRepo.delete).toHaveBeenCalledWith('leave-1')
        })
    })

    describe('calculateWorkingDays logic check (via createLeave)', () => {
        // Accessing private method indirectly via createLeave for testing logic flow
        it('should exclude holidays and non-working days', async () => {
            // Setup: Mon-Fri working days.
            // Request: Wed to Tue (7 days span)
            // Wed (Work), Thu (Holiday), Fri (Work), Sat (Off), Sun (Off), Mon (Work), Tue (Work)
            // Expected: 4 days

            const startDate = new Date('2024-01-03') // Wednesday
            const endDate = new Date('2024-01-09')   // Next Tuesday

            // Mock holiday on Jan 4th (Thursday)
            mockHolidayRepo.isHoliday.mockImplementation(async (date: Date, _tid: string) => {
                const d = date.toISOString().split('T')[0]
                return { isHoliday: d === '2024-01-04' }
            })

            mockUserRepo.findWorkScheduleByIdWithTenant.mockResolvedValue({
                id: 'user-1',
                workingHourMode: 'FIXED',
                workDays: 'Mon,Tue,Wed,Thu,Fri',
                tenantId,
            })

            mockLeaveRepo.create.mockResolvedValue({ status: 'APPROVED', tenantId })

            await service.createLeave({
                userId: 'user-1',
                type: 'CUTI',
                startDate,
                endDate,
                reason: 'Test'
            }, 'admin-1', tenantId, true)

            expect(mockBalanceRepo.incrementUsed).toHaveBeenCalledWith('user-1', 2024, 'CUTI', 4, tenantId)
        })
    })
})
