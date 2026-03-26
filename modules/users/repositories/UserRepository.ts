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
    canvasingTarget?: number
    targetSchema?: string
    isAttendanceRequired?: boolean
    tenantId?: string | null
    // Salary configuration
    basicSalary?: number
    payPeriodDay?: number
    payDay?: number
    woIncentiveEnabled?: boolean
    woIncentiveRate?: number
    lateDeductionRate?: number
    absentDeductionRate?: number
    overtimeRateNormal?: number
    overtimeRateHoliday?: number
    overtimeRateNational?: number
    overtimeCalcTypeNormal?: string
    overtimeCalcTypeHoliday?: string
    overtimeCalcTypeNational?: string
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
    async findAll(params: {
        siteId?: string;
        tenantId?: string;
        roleName?: string;
        page?: number;
        limit?: number;
        search?: string;
        isActive?: boolean;
    } = {}): Promise<{ data: UserWithRelations[], total: number, active: number, inactive: number }> {
        const { siteId, tenantId, roleName, page, limit, search, isActive } = params;
        
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
        if (isActive !== undefined) {
            where.isActive = isActive;
        }

        if (search) {
            where.OR = [
                { email: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
            ];
            // Prisma join search can be more tricky if we want to search department names. 
            // We'll add department search if needed, but for now email, name, phone is standard.
            // If they really need department search, it would look like:
            // { departments: { name: { contains: search, mode: 'insensitive' } } }
            where.OR.push({
                departments: { name: { contains: search, mode: 'insensitive' } }
            });
        }
        
        if (Object.keys(where).length > 0) {
            query.where = where
        }

        // Calculate pagination
        if (page && limit) {
            query.skip = (page - 1) * limit;
            query.take = limit;
        }

        const [users, total, active] = await prisma.$transaction([
            prisma.user.findMany(query),
            prisma.user.count({ where: query.where }),
            prisma.user.count({ where: { ...query.where, isActive: true } })
        ]);

        return {
            total,
            active,
            inactive: total - active,
            data: users.map((user) => {
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
        };
    }

    async findById(id: string): Promise<User | null> {
        return prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                departmentId: true,
                siteId: true,
                roleId: true,
                isActive: true,
                isSales: true,
                isAttendanceRequired: true,
                workingHourMode: true,
                attendanceGeofencePolicy: true,
                startWorkTime: true,
                endWorkTime: true,
                workDays: true,
                flexibleTargetHour: true,
                shiftId: true,
                canvasingTarget: true,
                targetSchema: true,
                tenantId: true,
                createdAt: true,
                updatedAt: true,
            }
        }) as unknown as Promise<User | null>
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
                isAttendanceRequired: data.isAttendanceRequired !== undefined ? data.isAttendanceRequired : true,
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
                canvasingTarget: data.canvasingTarget !== undefined ? data.canvasingTarget : 50,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                targetSchema: (data.targetSchema as any) || 'MONTHLY_RESET',
                // Salary configuration
                basicSalary: data.basicSalary || 0,
                payPeriodDay: data.payPeriodDay || 25,
                payDay: data.payDay || 1,
                woIncentiveEnabled: data.woIncentiveEnabled || false,
                woIncentiveRate: data.woIncentiveRate || 0,
                lateDeductionRate: data.lateDeductionRate || 0,
                absentDeductionRate: data.absentDeductionRate || 0,
                overtimeRateNormal: data.overtimeRateNormal || 0,
                overtimeRateHoliday: data.overtimeRateHoliday || 0,
                overtimeRateNational: data.overtimeRateNational || 0,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                overtimeCalcTypeNormal: (data.overtimeCalcTypeNormal as any) || 'PER_HOUR',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                overtimeCalcTypeHoliday: (data.overtimeCalcTypeHoliday as any) || 'PER_HOUR',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                overtimeCalcTypeNational: (data.overtimeCalcTypeNational as any) || 'PER_HOUR',
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
