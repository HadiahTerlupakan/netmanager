import { UserRepository } from '../repositories/UserRepository'
import { WorkingHourMode } from '@prisma/client'
import type { User } from '@prisma/client'

export class UserService {
    private userRepository: UserRepository

    constructor() {
        this.userRepository = new UserRepository()
    }

    async getUser(id: string): Promise<User | null> {
        return this.userRepository.findById(id)
    }

    async updateWorkingHours(id: string, data: {
        workingHourMode: WorkingHourMode
        startWorkTime?: string | null
        endWorkTime?: string | null
        workDays?: string | null
        flexibleTargetHour?: number | null
        shiftId?: string | null
    }): Promise<User> {
        // Validation logic
        if (data.workingHourMode === WorkingHourMode.FIXED) {
            if (!data.startWorkTime || !data.endWorkTime) {
                throw new Error('Start time and end time are required for Fixed mode')
            }
            if (!data.workDays) {
                throw new Error('Work days are required for Fixed mode')
            }
        }

        if (data.workingHourMode === WorkingHourMode.FLEXIBLE) {
            // Optional: Add specific validation for Flexible mode if needed
        }

        return this.userRepository.updateWorkingHours(id, data)
    }
}
