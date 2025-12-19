import { prisma } from '@/lib/prisma'
import { WorkingHourMode, Prisma } from '@prisma/client'
import type { User } from '@prisma/client'

export class UserRepository {
    async findById(id: string): Promise<User | null> {
        return prisma.user.findUnique({
            where: { id },
        })
    }

    async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
        return prisma.user.update({
            where: { id },
            data,
        })
    }

    async updateWorkingHours(id: string, data: {
        workingHourMode: WorkingHourMode
        startWorkTime?: string | null
        endWorkTime?: string | null
        workDays?: string | null
        flexibleTargetHour?: number | null
        shiftId?: string | null
    }): Promise<User> {
        return prisma.user.update({
            where: { id },
            data: {
                workingHourMode: data.workingHourMode,
                startWorkTime: data.startWorkTime,
                endWorkTime: data.endWorkTime,
                workDays: data.workDays,
                flexibleTargetHour: data.flexibleTargetHour,
                shiftId: data.shiftId
            }
        })
    }
}
