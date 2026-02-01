import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ShiftService } from '@/modules/shift/services/ShiftService'

// Mock repository
const mockShiftRepo = {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByCode: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    hardDelete: vi.fn(),
    getUserCount: vi.fn(),
}

// Mock Repository Class
vi.mock('@/modules/shift/repositories/ShiftRepository', () => ({
    ShiftRepository: class {
        constructor() {
            return mockShiftRepo
        }
    }
}))

describe('ShiftService', () => {
    let service: ShiftService

    beforeEach(() => {
        vi.clearAllMocks()
        service = new ShiftService()
    })

    describe('createShift', () => {
        const input = {
            name: 'Morning Shift',
            code: 'S1',
            startTime: '08:00',
            endTime: '16:00',
            description: 'Regular morning shift'
        }

        it('should create a shift successfully', async () => {
            mockShiftRepo.findByCode.mockResolvedValue(null)
            mockShiftRepo.create.mockResolvedValue({ id: 'shift-1', ...input })

            const result = await service.createShift(input)

            expect(result).toEqual(expect.objectContaining(input))
            expect(mockShiftRepo.create).toHaveBeenCalledWith(input)
        })

        it('should throw error for invalid start time format', async () => {
            await expect(service.createShift({ ...input, startTime: '8:00' }))
                .rejects.toThrow('Invalid start time format')
        })

        it('should throw error for invalid end time format', async () => {
            await expect(service.createShift({ ...input, endTime: '25:00' }))
                .rejects.toThrow('Invalid end time format')
        })

        it('should throw error if code already exists', async () => {
            mockShiftRepo.findByCode.mockResolvedValue({ id: 'existing', code: 'S1' })

            await expect(service.createShift(input))
                .rejects.toThrow('Shift code already exists')
        })
    })

    describe('updateShift', () => {
        const existingShift = {
            id: 'shift-1',
            name: 'Morning Shift',
            code: 'S1',
            startTime: '08:00',
            endTime: '16:00'
        }

        it('should update shift successfully', async () => {
            mockShiftRepo.findById.mockResolvedValue(existingShift)
            mockShiftRepo.findByCode.mockResolvedValue(null)
            mockShiftRepo.update.mockResolvedValue({ ...existingShift, name: 'Updated Name' })

            const result = await service.updateShift('shift-1', { name: 'Updated Name' })

            expect(result.name).toBe('Updated Name')
            expect(mockShiftRepo.update).toHaveBeenCalledWith('shift-1', { name: 'Updated Name' })
        })

        it('should throw error if shift not found', async () => {
            mockShiftRepo.findById.mockResolvedValue(null)

            await expect(service.updateShift('invalid', { name: 'New' }))
                .rejects.toThrow('Shift not found')
        })

        it('should throw error if new code exists', async () => {
            mockShiftRepo.findById.mockResolvedValue(existingShift)
            mockShiftRepo.findByCode.mockResolvedValue({ id: 'other', code: 'S2' })

            await expect(service.updateShift('shift-1', { code: 'S2' }))
                .rejects.toThrow('Shift code already exists')
        })
    })

    describe('deleteShift', () => {
        it('should soft delete by default', async () => {
            mockShiftRepo.findById.mockResolvedValue({ id: 'shift-1' })
            mockShiftRepo.getUserCount.mockResolvedValue(0)

            await service.deleteShift('shift-1', true) // Force true for soft delete in service implementation logic

            expect(mockShiftRepo.delete).toHaveBeenCalledWith('shift-1')
        })

        it('should hard delete if not forced and no users', async () => {
            mockShiftRepo.findById.mockResolvedValue({ id: 'shift-1' })
            mockShiftRepo.getUserCount.mockResolvedValue(0)

            await service.deleteShift('shift-1', false)

            expect(mockShiftRepo.hardDelete).toHaveBeenCalledWith('shift-1')
        })

        it('should throw error if assigned to users and not forced', async () => {
            mockShiftRepo.findById.mockResolvedValue({ id: 'shift-1' })
            mockShiftRepo.getUserCount.mockResolvedValue(5)

            await expect(service.deleteShift('shift-1', false))
                .rejects.toThrow('Cannot delete shift')
        })
    })
})
