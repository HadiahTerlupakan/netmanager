import { prisma } from '@/lib/prisma'
import { WorkingHourMode, Prisma } from '@prisma/client'
import type { User } from '@prisma/client'

export interface CreateUserDTO {
    email: string
    name?: string | null
    passwordHash: string
    phone?: string | null
    departmentId?: string | null
    siteId?: string | null
    roleId?: string | null
    isActive?: boolean
}

export interface UserWithRelations extends User {
    department?: { id: string; name: string } | null
    site?: { id: string; code: string; name: string } | null
    role?: { id: string; name: string } | null
}

export class UserRepository {
    async findAll(): Promise<UserWithRelations[]> {
        return prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                department: { select: { id: true, name: true } },
                site: { select: { id: true, code: true, name: true } },
                role: { select: { id: true, name: true } },
            },
        })
    }

    async findById(id: string): Promise<User | null> {
        return prisma.user.findUnique({
            where: { id },
        })
    }

    async findByIdWithRelations(id: string): Promise<UserWithRelations | null> {
        return prisma.user.findUnique({
            where: { id },
            include: {
                department: { select: { id: true, name: true } },
                site: { select: { id: true, code: true, name: true } },
                role: { select: { id: true, name: true } },
            },
        })
    }

    async findByEmail(email: string): Promise<User | null> {
        return prisma.user.findUnique({
            where: { email },
        })
    }

    async create(data: CreateUserDTO): Promise<User> {
        return prisma.user.create({
            data: {
                email: data.email,
                name: data.name || null,
                passwordHash: data.passwordHash,
                phone: data.phone || null,
                departmentId: data.departmentId || null,
                siteId: data.siteId || null,
                roleId: data.roleId || null,
                isActive: data.isActive !== undefined ? data.isActive : true,
            },
        })
    }

    async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
        return prisma.user.update({
            where: { id },
            data,
        })
    }

    async delete(id: string): Promise<User> {
        return prisma.user.delete({
            where: { id },
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

