import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
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
    // Working Hours Settings
    workingHourMode?: WorkingHourMode
    startWorkTime?: string | null
    endWorkTime?: string | null
    workDays?: string | null
    flexibleTargetHour?: number | null
    shiftId?: string | null
    // Sales Feature
    isSales?: boolean
}

export interface UserWithRelations extends User {
    department?: { id: string; name: string } | null
    site?: { id: string; code: string; name: string } | null
    role?: { id: string; name: string } | null
    userSites?: Array<{
        id: string
        siteId: string
        isPrimary: boolean
        site: { id: string; code: string; name: string }
    }>
}

export class UserRepository {
    async findAll(siteId?: string): Promise<UserWithRelations[]> {

        const users = await prisma.user.findMany({
            where: siteId ? { siteId } : undefined,
            orderBy: { createdAt: 'desc' },
            include: {
                departments: { select: { id: true, name: true } },
                sites: { select: { id: true, code: true, name: true } },
                role: { select: { id: true, name: true } },
                userSites: {
                    select: {
                        id: true,
                        siteId: true,
                        isPrimary: true,
                        site: { select: { id: true, code: true, name: true } }
                    },
                    orderBy: { isPrimary: 'desc' }
                },
            },
        })

        return users.map(user => ({
            ...user,
            department: user.departments,
            site: user.sites,
            role: user.role,
            userSites: user.userSites
        }))
    }

    async findById(id: string): Promise<User | null> {
        return prisma.user.findUnique({
            where: { id },
        })
    }

    async findByIdWithRelations(id: string): Promise<UserWithRelations | null> {
        const user = await prisma.user.findUnique({
            where: { id },
            include: {
                departments: { select: { id: true, name: true } },
                sites: { select: { id: true, code: true, name: true } },
                role: { select: { id: true, name: true } },
            },
        })
        
        if (!user) return null

        return {
            ...user,
            department: user.departments,
            site: user.sites,
            role: user.role
        }
    }

    async findByEmail(email: string): Promise<User | null> {
        return prisma.user.findUnique({
            where: { email },
        })
    }

    async create(data: CreateUserDTO): Promise<User> {
        return prisma.user.create({
            data: {
                id: randomUUID(),
                updatedAt: new Date(),
                email: data.email,
                name: data.name || null,
                passwordHash: data.passwordHash,
                phone: data.phone || null,
                departmentId: data.departmentId || null,
                siteId: data.siteId || null,
                roleId: data.roleId || null,
                isActive: data.isActive !== undefined ? data.isActive : true,
                // Working Hours Settings
                workingHourMode: data.workingHourMode || WorkingHourMode.FIXED,
                startWorkTime: data.startWorkTime || '09:00',
                endWorkTime: data.endWorkTime || '17:00',
                workDays: data.workDays || 'Mon,Tue,Wed,Thu,Fri',
                flexibleTargetHour: data.flexibleTargetHour || 8,
                shiftId: data.shiftId || null,
                // Sales Feature
                isSales: data.isSales || false,
            },
        })
    }

    async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
        return prisma.user.update({
            where: { id },
            data: {
                ...data,
                updatedAt: new Date()
            },
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

