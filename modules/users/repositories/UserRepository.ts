import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { AttendanceGeofencePolicy, WorkingHourMode, Prisma } from '@prisma/client'
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
    attendanceGeofencePolicy?: AttendanceGeofencePolicy
    startWorkTime?: string | null
    endWorkTime?: string | null
    workDays?: string | null
    flexibleTargetHour?: number | null
    shiftId?: string | null
    // Sales Feature
    isSales?: boolean
    tenantId?: string | null
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
    async findAll(siteId?: string, tenantId?: string, roleName?: string): Promise<UserWithRelations[]> {
        const query: Prisma.UserFindManyArgs = {
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
        }

        const where: Prisma.UserWhereInput = {}
        if (siteId) where.siteId = siteId
        if (tenantId) where.tenantId = tenantId
        if (roleName) {
            where.role = {
                name: {
                    equals: roleName,
                    mode: 'insensitive'
                }
            }
        }
        
        if (Object.keys(where).length > 0) {
            query.where = where
        }

        const users = await prisma.user.findMany(query)

        return users.map((user) => {
            const userWithMeta = user as unknown as {
                departments: { id: string; name: string } | null;
                sites: { id: string; code: string; name: string } | null;
                role: { id: string; name: string } | null;
                userSites: Array<{
                    id: string;
                    siteId: string;
                    isPrimary: boolean;
                    site: { id: string; code: string; name: string };
                }>;
            } & User;

            return {
                ...user,
                department: userWithMeta.departments,
                site: userWithMeta.sites,
                role: userWithMeta.role,
                userSites: userWithMeta.userSites
            };
        })
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
            department: (user as Record<string, unknown>).departments as { id: string; name: string } | null,
            site: (user as Record<string, unknown>).sites as { id: string; code: string; name: string } | null,
            role: (user as Record<string, unknown>).role as { id: string; name: string } | null
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
                attendanceGeofencePolicy: data.attendanceGeofencePolicy || AttendanceGeofencePolicy.WARN,
                startWorkTime: data.startWorkTime || '09:00',
                endWorkTime: data.endWorkTime || '17:00',
                workDays: data.workDays || 'Mon,Tue,Wed,Thu,Fri',
                flexibleTargetHour: data.flexibleTargetHour || 8,
                shiftId: data.shiftId || null,
                // Sales Feature
                isSales: data.isSales || false,
                // Tenant Support: Allow manual tenantId for Super Admin bypass
                ...(data.tenantId && { tenantId: data.tenantId }),
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
        const updateData: Prisma.UserUncheckedUpdateInput = {
            workingHourMode: data.workingHourMode
        }
        
        if (data.startWorkTime !== undefined) updateData.startWorkTime = data.startWorkTime
        if (data.endWorkTime !== undefined) updateData.endWorkTime = data.endWorkTime
        if (data.workDays !== undefined) updateData.workDays = data.workDays
        if (data.flexibleTargetHour !== undefined) updateData.flexibleTargetHour = data.flexibleTargetHour
        if (data.shiftId !== undefined) updateData.shiftId = data.shiftId

        return prisma.user.update({
            where: { id },
            data: updateData
        })
    }
}
