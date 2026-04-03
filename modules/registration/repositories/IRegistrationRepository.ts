import type { Registrations, Prisma } from '@prisma/client'
import { RegistrationStatus } from '@prisma/client'

export interface IRegistrationRepository {
    findById(id: string): Promise<Registrations | null>
    findByEmailOrPhone(email: string, phone: string, status?: RegistrationStatus): Promise<Registrations | null>
    create(data: Omit<Prisma.RegistrationsCreateInput, 'id' | 'updatedAt'>): Promise<Registrations>
    updateStatus(id: string, status: RegistrationStatus): Promise<Registrations>
    getSettingValue(key: string): Promise<string | null>
}
