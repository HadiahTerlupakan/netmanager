import type { Registration, Prisma } from '@prisma/client'
import { RegistrationStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { IRegistrationRepository } from './IRegistrationRepository'

export class RegistrationRepository implements IRegistrationRepository {

    async findById(id: string): Promise<Registration | null> {
        return prisma.registration.findUnique({
            where: { id }
        })
    }

    async findByEmailOrPhone(email: string, phone: string, status?: RegistrationStatus): Promise<Registration | null> {
        return prisma.registration.findFirst({
            where: {
                ...(status ? { status } : {}),
                OR: [
                    { email },
                    { phone }
                ]
            }
        })
    }

    async create(data: Prisma.RegistrationCreateInput): Promise<Registration> {
        return prisma.registration.create({ data })
    }

    async updateStatus(id: string, status: RegistrationStatus): Promise<Registration> {
        return prisma.registration.update({
            where: { id },
            data: { status }
        })
    }
}
