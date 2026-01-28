import type { Registrations, Prisma } from '@prisma/client'
import { RegistrationStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import type { IRegistrationRepository } from './IRegistrationRepository'

export class RegistrationRepository implements IRegistrationRepository {
    async findById(id: string): Promise<Registrations | null> {
        return prisma.registrations.findUnique({
            where: { id }
        })
    }

    async findAll(): Promise<Registrations[]> {
        return prisma.registrations.findMany({
            orderBy: { createdAt: 'desc' }
        })
    }


    async findByEmailOrPhone(email: string, phone: string, status?: RegistrationStatus): Promise<Registrations | null> {
        return prisma.registrations.findFirst({
            where: {
                ...(status ? { status } : {}),
                OR: [
                    { email },
                    { phone }
                ]
            }
        })
    }

    async create(data: Omit<Prisma.RegistrationsCreateInput, 'id' | 'updatedAt'>): Promise<Registrations> {
        return prisma.registrations.create({
            data: {
                ...data,
                id: randomUUID(),
                updatedAt: new Date()
            } as Prisma.RegistrationsCreateInput
        })
    }

    async updateStatus(id: string, status: RegistrationStatus): Promise<Registrations> {
        return prisma.registrations.update({
            where: { id },
            data: { 
                status,
                updatedAt: new Date()
            }
        })
    }

    async updateWithDetails(id: string, data: {
        status: RegistrationStatus
        notes?: string | null
        rejectionReason?: string
        verifiedAt?: Date
        verifiedBy?: string
    }): Promise<Registrations> {
        return prisma.registrations.update({
            where: { id },
            data: {
                status: data.status,
                notes: data.notes,
                rejectionReason: data.rejectionReason,
                verifiedAt: data.verifiedAt,
                verifiedBy: data.verifiedBy,
                updatedAt: new Date()
            }
        })
    }

    async delete(id: string): Promise<void> {
        await prisma.registrations.delete({
            where: { id }
        })
    }
}
