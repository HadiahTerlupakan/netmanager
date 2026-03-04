import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '../../setup'
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

// Mock Repository Classes
vi.mock('@/modules/attendance/repositories/LeaveRepository', () => ({
    LeaveRepository: class {
        constructor() {
            return mockLeaveRepo
        }
    }
}))

vi.mock('@/modules/attendance/repositories/LeaveBalanceRepository', () => ({
    LeaveBalanceRepository: class {
        constructor() {
            return mockBalanceRepo
        }
    }
}))

vi.mock('@/modules/attendance/repositories/HolidayRepository', () => ({
    HolidayRepository: class {
        constructor() {
            return mockHolidayRepo
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

    beforeEach(() => {
        vi.clearAllMocks()
        service = new LeaveService()
        // Reset default mock behaviors
        mockHolidayRepo.isHoliday.mockResolvedValue({ isHoliday: false })
        mockBalanceRepo.hasEnoughDays.mockResolvedValue(true)
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
            mockLeaveRepo.create.mockResolvedValue({ id: 'leave-1', ...createData, status: 'PENDING' })

            const result = await service.createLeave(createData, 'admin-1', false)

            expect(result.success).toBe(true)
            expect(mockLeaveRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                status: 'PENDING'
            }))
            expect(mockBalanceRepo.incrementUsed).not.toHaveBeenCalled()
        })

        it('should create approved leave and deduct balance if autoApprove is true', async () => {
            // Mock user to have fixed schedule
            prismaMock.user.findUnique.mockResolvedValue({
                id: 'user-1',
                workingHourMode: 'FIXED',
                workDays: 'Mon,Tue,Wed,Thu,Fri'
            } as unknown as { id: string; workingHourMode: string; workDays: string })

            mockLeaveRepo.create.mockResolvedValue({ id: 'leave-1', ...createData, status: 'APPROVED' })

            const result = await service.createLeave(createData, 'admin-1', true)

            expect(result.success).toBe(true)
            expect(mockLeaveRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                status: 'APPROVED'
            }))
            // 2 days (Mon, Tue)
            expect(mockBalanceRepo.incrementUsed).toHaveBeenCalledWith('user-1', 2024, 'CUTI', 2)
        })

        it('should fail if balance is insufficient for auto-approved leave', async () => {
            prismaMock.user.findUnique.mockResolvedValue({
                id: 'user-1',
                workingHourMode: 'FIXED',
                workDays: 'Mon,Tue,Wed,Thu,Fri'
            } as unknown as { id: string; workingHourMode: string; workDays: string })

            mockBalanceRepo.hasEnoughDays.mockResolvedValue(false)

            const result = await service.createLeave(createData, 'admin-1', true)

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
            user: {
                id: 'user-1',
                name: 'John Doe',
                workingHourMode: 'FIXED',
                workDays: 'Mon,Tue,Wed,Thu,Fri'
            }
        }

        it('should approve leave and deduct balance', async () => {
            prismaMock.leaveRequest.findUnique.mockResolvedValue(leaveRequest as unknown as { id: string; userId: string; type: string; startDate: Date; endDate: Date; status: string; user: { id: string; name: string; workingHourMode: string; workDays: string } })
            mockLeaveRepo.update.mockResolvedValue({ ...leaveRequest, status: 'APPROVED' })

            const result = await service.approveLeave('leave-1', 'admin-1')

            expect(result.success).toBe(true)
            expect(mockBalanceRepo.incrementUsed).toHaveBeenCalledWith('user-1', 2024, 'CUTI', 3)
            expect(mockLeaveRepo.update).toHaveBeenCalledWith('leave-1', expect.objectContaining({
                status: 'APPROVED'
            }))
        })

        it('should fail approval if balance is insufficient', async () => {
            prismaMock.leaveRequest.findUnique.mockResolvedValue(leaveRequest as unknown as { id: string; userId: string; type: string; startDate: Date; endDate: Date; status: string; user: { id: string; name: string; workingHourMode: string; workDays: string } })
            mockBalanceRepo.hasEnoughDays.mockResolvedValue(false)

            const result = await service.approveLeave('leave-1', 'admin-1')

            expect(result.success).toBe(false)
            expect(result.code).toBe('INSUFFICIENT_BALANCE')
            expect(mockLeaveRepo.update).not.toHaveBeenCalled()
        })

        it('should not deduct balance for FLEXIBLE users', async () => {
            const flexUserLeave = {
                ...leaveRequest,
                user: { ...leaveRequest.user, workingHourMode: 'FLEXIBLE' }
            }
            prismaMock.leaveRequest.findUnique.mockResolvedValue(flexUserLeave as unknown as { id: string; userId: string; type: string; startDate: Date; endDate: Date; status: string; user: { id: string; name: string; workingHourMode: string; workDays: string } })
            mockLeaveRepo.update.mockResolvedValue({ ...flexUserLeave, status: 'APPROVED' })

            const result = await service.approveLeave('leave-1', 'admin-1')

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
            user: {
                id: 'user-1',
                workingHourMode: 'FIXED',
                workDays: 'Mon,Tue,Wed,Thu,Fri'
            }
        }

        it('should refund balance when rejecting approved leave', async () => {
            prismaMock.leaveRequest.findUnique.mockResolvedValue(approvedLeave as unknown as { id: string; userId: string; type: string; startDate: Date; endDate: Date; status: string; user: { id: string; workingHourMode: string; workDays: string } })
            mockLeaveRepo.update.mockResolvedValue({ ...approvedLeave, status: 'REJECTED' })

            const result = await service.rejectLeave('leave-1', 'admin-1', 'Reason')

            expect(result.success).toBe(true)
            expect(mockBalanceRepo.decrementUsed).toHaveBeenCalledWith('user-1', 2024, 'CUTI', 1)
        })

        it('should NOT refund balance when rejecting pending leave', async () => {
            const pendingLeave = { ...approvedLeave, status: 'PENDING' }
            prismaMock.leaveRequest.findUnique.mockResolvedValue(pendingLeave as unknown as { id: string; userId: string; type: string; startDate: Date; endDate: Date; status: string; user: { id: string; workingHourMode: string; workDays: string } })
            mockLeaveRepo.update.mockResolvedValue({ ...pendingLeave, status: 'REJECTED' })

            const result = await service.rejectLeave('leave-1', 'admin-1', 'Reason')

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
            user: {
                id: 'user-1',
                workingHourMode: 'FIXED',
                workDays: 'Mon,Tue,Wed,Thu,Fri'
            }
        }

        it('should refund balance when deleting approved leave', async () => {
            prismaMock.leaveRequest.findUnique.mockResolvedValue(approvedLeave as unknown as { id: string; userId: string; type: string; startDate: Date; endDate: Date; status: string; user: { id: string; workingHourMode: string; workDays: string } })

            const result = await service.deleteLeave('leave-1', 'admin-1')

            expect(result.success).toBe(true)
            expect(mockBalanceRepo.decrementUsed).toHaveBeenCalledWith('user-1', 2024, 'CUTI', 1)
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
            mockHolidayRepo.isHoliday.mockImplementation(async (date: Date) => {
                const d = date.toISOString().split('T')[0]
                return { isHoliday: d === '2024-01-04' }
            })

            prismaMock.user.findUnique.mockResolvedValue({
                id: 'user-1',
                workingHourMode: 'FIXED',
                workDays: 'Mon,Tue,Wed,Thu,Fri'
            } as unknown as { id: string; workingHourMode: string; workDays: string })

            mockLeaveRepo.create.mockResolvedValue({ status: 'APPROVED' })

            await service.createLeave({
                userId: 'user-1',
                type: 'CUTI',
                startDate,
                endDate,
                reason: 'Test'
            }, 'admin-1', true)

            expect(mockBalanceRepo.incrementUsed).toHaveBeenCalledWith('user-1', 2024, 'CUTI', 4)
        })
    })
})
