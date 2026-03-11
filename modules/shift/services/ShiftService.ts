import type { Shift } from '@prisma/client'
import { isPrismaRecordNotFoundError } from '@/lib/prisma-errors'
import { ShiftRepository, type CreateShiftInput, type UpdateShiftInput } from '../repositories/ShiftRepository'

export class ShiftService {
  private repository: ShiftRepository

  constructor() {
    this.repository = new ShiftRepository()
  }

  async getAllShifts(includeInactive = false): Promise<Shift[]> {
    return this.repository.findAll(includeInactive)
  }

  async getShiftById(id: string): Promise<Shift | null> {
    return this.repository.findById(id)
  }

  async createShift(input: CreateShiftInput): Promise<Shift> {
    // Validate time format
    if (!this.isValidTimeFormat(input.startTime)) {
      throw new Error('Invalid start time format. Use HH:mm')
    }
    if (!this.isValidTimeFormat(input.endTime)) {
      throw new Error('Invalid end time format. Use HH:mm')
    }

    // Check code uniqueness if provided
    if (input.code) {
      const existing = await this.repository.findByCode(input.code)
      if (existing) {
        throw new Error('Shift code already exists')
      }
    }

    return this.repository.create(input)
  }

  async updateShift(id: string, input: UpdateShiftInput): Promise<Shift> {
    const existing = await this.repository.findById(id)
    if (!existing) {
      throw new Error('Shift not found')
    }

    // Validate time format if provided
    if (input.startTime && !this.isValidTimeFormat(input.startTime)) {
      throw new Error('Invalid start time format. Use HH:mm')
    }
    if (input.endTime && !this.isValidTimeFormat(input.endTime)) {
      throw new Error('Invalid end time format. Use HH:mm')
    }

    // Check code uniqueness if changed
    if (input.code && input.code !== existing.code) {
      const existingCode = await this.repository.findByCode(input.code)
      if (existingCode) {
        throw new Error('Shift code already exists')
      }
    }

    return this.repository.update(id, input)
  }

  async deleteShift(id: string, force = false): Promise<void> {
    const existing = await this.repository.findById(id)
    if (!existing) {
      throw new Error('Shift not found')
    }

    // Check if shift is assigned to users
    const userCount = await this.repository.getUserCount(id)
    if (userCount > 0 && !force) {
      throw new Error(`Cannot delete shift. It is assigned to ${userCount} user(s). Use force=true to soft delete.`)
    }

    try {
      if (force) {
        // Soft delete
        await this.repository.delete(id)
      } else {
        // Hard delete (only if no users)
        await this.repository.hardDelete(id)
      }
    } catch (error) {
      if (isPrismaRecordNotFoundError(error)) {
        throw new Error('Shift not found')
      }

      throw error
    }
  }

  private isValidTimeFormat(time: string): boolean {
    const regex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/
    const isValid = regex.test(time)
    // console.log(`Validating time: ${time}, result: ${isValid}`)
    return isValid
  }
}
