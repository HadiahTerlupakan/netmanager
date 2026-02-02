import { prisma } from '@/lib/prisma'
import type { Shift } from '@prisma/client'

export interface CreateShiftInput {
  name: string
  code?: string
  startTime: string
  endTime: string
  description?: string
}

export interface UpdateShiftInput {
  name?: string
  code?: string
  startTime?: string
  endTime?: string
  description?: string
  isActive?: boolean
}

export class ShiftRepository {
  async findAll(includeInactive = false): Promise<Shift[]> {
    return prisma.shift.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: 'asc' }
    })
  }

  async findById(id: string): Promise<Shift | null> {
    return prisma.shift.findUnique({
      where: { id }
    })
  }

  async findByCode(code: string): Promise<Shift | null> {
    return prisma.shift.findUnique({
      where: { code }
    })
  }

  async create(data: CreateShiftInput): Promise<Shift> {
    return prisma.shift.create({
      data: {
        name: data.name,
        code: data.code || null,
        startTime: data.startTime,
        endTime: data.endTime,
        description: data.description || null
      }
    })
  }

  async update(id: string, data: UpdateShiftInput): Promise<Shift> {
    return prisma.shift.update({
      where: { id },
      data: {
        name: data.name,
        code: data.code,
        startTime: data.startTime,
        endTime: data.endTime,
        description: data.description,
        isActive: data.isActive
      }
    })
  }

  async delete(id: string): Promise<void> {
    // Soft delete - set isActive to false AND rename code if exists to release unique constraint
    const shift = await this.findById(id)
    if (!shift) return

    const updateData: Partial<{ isActive: boolean, code: string }> = { isActive: false }

    if (shift.code) {
      // Append timestamp to code to make it unique but preserve history
      // e.g. "S1" -> "S1_DELETED_1700000000"
      // Truncate to ensure it fits? Prisma usually handles string length,
      // but if code length is constrained we might need care.
      // Assuming standard string length is fine.
      updateData.code = `${shift.code}_DEL_${Math.floor(Date.now() / 1000)}`
    }

    await prisma.shift.update({
      where: { id },
      data: updateData
    })
  }

  async hardDelete(id: string): Promise<void> {
    await prisma.shift.delete({
      where: { id }
    })
  }

  async getUserCount(shiftId: string): Promise<number> {
    return prisma.user.count({
      where: { shiftId }
    })
  }
}
