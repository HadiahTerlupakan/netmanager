import type { Registration, Prisma } from '@prisma/client'
import { RegistrationStatus } from '@prisma/client'

export interface IRegistrationRepository {
    findById(id: string): Promise<Registration | null>
    findByEmailOrPhone(email: string, phone: string, status?: RegistrationStatus): Promise<Registration | null>
    create(data: Prisma.RegistrationCreateInput): Promise<Registration>
    updateStatus(id: string, status: RegistrationStatus): Promise<Registration>
}
