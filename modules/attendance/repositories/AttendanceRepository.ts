import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type { AttendanceStatus } from '@prisma/client'
import { HolidayRepository } from './HolidayRepository'
import { getTenantIdFromContext } from '@/lib/tenant-context'

export class AttendanceRepository {
    async findMany<T extends Prisma.AttendanceFindManyArgs>(
        params: Prisma.SelectSubset<T, Prisma.AttendanceFindManyArgs>
    ): Promise<Prisma.AttendanceGetPayload<T>[]> {
        return prisma.attendance.findMany(params)
    }

    async findFirst<T extends Prisma.AttendanceFindFirstArgs>(
        params: Prisma.SelectSubset<T, Prisma.AttendanceFindFirstArgs>
    ): Promise<Prisma.AttendanceGetPayload<T> | null> {
        return prisma.attendance.findFirst(params)
    }

    async findFirstWithUser(params: {
        where: Prisma.AttendanceWhereInput
        orderBy?: Prisma.AttendanceOrderByWithRelationInput
        userSelect?: {
            workingHourMode?: boolean
            flexibleTargetHour?: boolean
            workDays?: boolean
        }
    }) {
        return prisma.attendance.findFirst({
            where: params.where,
            orderBy: params.orderBy,
            include: {
                user: {
                    select: params.userSelect
                }
            }
        })
    }


    async count(where?: Prisma.AttendanceWhereInput) {
        return prisma.attendance.count({
            ...(where ? { where } : {})
        })
    }

    async getStatsByDateRange(startDate: Date, endDate: Date, siteId?: string, departmentId?: string) {
        let userIds: string[] | undefined = undefined
        if (siteId || departmentId) {
            const users = await prisma.user.findMany({
                where: {
                    ...(siteId && { siteId }),
                    ...(departmentId && { departmentId })
                },
                select: { id: true }
            })
            userIds = users.map(u => u.id)
            
            if (userIds.length === 0) {
                return {
                    total: 0,
                    avgDurationMinutes: 0,
                    statusCounts: {}
                }
            }
        }

        const where: Prisma.AttendanceWhereInput = {
            checkIn: { gte: startDate, lte: endDate },
            ...(userIds !== undefined && { userId: { in: userIds } })
        }

        const statusCounts = await prisma.attendance.groupBy({
            by: ['status'],
            where,
            _count: { _all: true }
        })

        const total = await prisma.attendance.count({ where })

        const { tenantId, isSuperAdmin } = await getTenantIdFromContext()
        const effectiveTenantId = (!isSuperAdmin && !tenantId) ? '___MISSING_TENANT_ID___' : tenantId

        let query = Prisma.sql`
            SELECT
                AVG(EXTRACT(EPOCH FROM (a."checkOut" - a."checkIn")) / 60)::float as "avgDuration"
            FROM "Attendance" a
            WHERE a."checkIn" >= ${startDate}
            AND a."checkIn" <= ${endDate}
            AND a."checkOut" IS NOT NULL
        `

        if (!isSuperAdmin) {
            query = Prisma.sql`${query} AND a."tenantId" = ${effectiveTenantId}`
        }

        if (userIds !== undefined) {
            query = Prisma.sql`${query} AND a."userId" IN (${Prisma.join(userIds)})`
        }

        const avgResult = await prisma.$queryRaw<{ avgDuration: number }[]>(query)

        const avgDurationMinutes = avgResult[0]?.avgDuration ? Math.round(avgResult[0].avgDuration) : 0

        return {
            total,
            avgDurationMinutes,
            statusCounts: statusCounts.reduce((acc: Record<string, number>, curr: { status: string, _count: { _all: number } }) => {
                acc[curr.status] = curr._count._all
                return acc
            }, {} as Record<string, number>)
        }
    }

    async getDailyStats(startDate: Date, endDate: Date, siteId?: string, departmentId?: string) {
        const { tenantId, isSuperAdmin } = await getTenantIdFromContext()
        const effectiveTenantId = (!isSuperAdmin && !tenantId) ? '___MISSING_TENANT_ID___' : tenantId

        let userIds: string[] | undefined = undefined
        if (siteId || departmentId) {
            const users = await prisma.user.findMany({
                where: {
                    ...(siteId && { siteId }),
                    ...(departmentId && { departmentId })
                },
                select: { id: true }
            })
            userIds = users.map(u => u.id)
            
            if (userIds.length === 0) {
                return []
            }
        }

        let query = Prisma.sql`
            SELECT
                TO_CHAR(a."checkIn", 'YYYY-MM-DD') as date,
                COUNT(CASE WHEN a.status IN ('ON_TIME', 'LATE') THEN 1 END)::int as present,
                COUNT(CASE WHEN a.status = 'LATE' THEN 1 END)::int as late
            FROM "Attendance" a
            WHERE a."checkIn" >= ${startDate}
            AND a."checkIn" <= ${endDate}
        `

        if (!isSuperAdmin) {
            query = Prisma.sql`${query} AND a."tenantId" = ${effectiveTenantId}`
        }

        if (userIds !== undefined) {
            query = Prisma.sql`${query} AND a."userId" IN (${Prisma.join(userIds)})`
        }

        query = Prisma.sql`${query} GROUP BY TO_CHAR(a."checkIn", 'YYYY-MM-DD')`

        const attendanceStats = await prisma.$queryRaw<{ date: string, present: number, late: number }[]>(query)

        const holidayRepo = new HolidayRepository()
        const holidays = await holidayRepo.findMany(tenantId, {
            where: { date: { gte: startDate, lte: endDate } }
        })
        const holidaySet = new Set<string>(holidays.map((h: { date: Date }) => h.date.toISOString().split('T')[0]))

        const leaveWhere: Prisma.LeaveRequestWhereInput = {
            status: 'APPROVED',
            startDate: { lte: endDate },
            endDate: { gte: startDate },
            ...(userIds !== undefined && { userId: { in: userIds } })
        }
        
        const leaves = await prisma.leaveRequest.findMany({
            where: leaveWhere,
            select: { startDate: true, endDate: true, type: true }
        })

        const dailyMap = new Map<string, { present: number, late: number, absent: number, isHoliday: boolean, sakit: number, cuti: number, izin: number }>()

        const ensureDate = (dateKey: string) => {
            if (!dailyMap.has(dateKey)) {
                dailyMap.set(dateKey, { present: 0, late: 0, absent: 0, isHoliday: holidaySet.has(dateKey), sakit: 0, cuti: 0, izin: 0 })
            }
            return dailyMap.get(dateKey)!
        }

        attendanceStats.forEach((stat: { date: string, present: number, late: number }) => {
            const d = ensureDate(stat.date)
            d.present = stat.present
            d.late = stat.late
        })

        holidaySet.forEach((date: string) => {
            if(date) ensureDate(date)
        })

        leaves.forEach((leave: { startDate: Date, endDate: Date, type: string }) => {
            const current = new Date(leave.startDate)
            const end = new Date(leave.endDate)
            while (current <= end) {
                if (current >= startDate && current <= endDate) {
                    const dateKey = current.toISOString().split('T')[0] ?? ''
                    if (dateKey) {
                        const stats = ensureDate(dateKey)
                        if (leave.type === 'SAKIT') stats.sakit++
                        else if (leave.type === 'CUTI') stats.cuti++
                        else if (leave.type === 'IZIN') stats.izin++
                    }
                }
                current.setDate(current.getDate() + 1)
            }
        })

        return Array.from(dailyMap.entries()).map(([date, stats]) => ({
            date,
            ...stats
        })).sort((a, b) => a.date.localeCompare(b.date))
    }

    async getGroupedStats(
        startDate: Date,
        endDate: Date,
        groupBy: 'department' | 'site'
    ) {
        const { tenantId, isSuperAdmin } = await getTenantIdFromContext()
        const effectiveTenantId = (!isSuperAdmin && !tenantId) ? '___MISSING_TENANT_ID___' : tenantId

        const query = Prisma.sql`
            SELECT
                a."userId",
                COUNT(CASE WHEN a.status IN ('ON_TIME', 'LATE') THEN 1 END)::int as present,
                COUNT(CASE WHEN a.status = 'LATE' THEN 1 END)::int as late,
                COUNT(*)::int as total
            FROM "Attendance" a
            WHERE a."checkIn" >= ${startDate}
            AND a."checkIn" <= ${endDate}
            ${!isSuperAdmin ? Prisma.sql`AND a."tenantId" = ${effectiveTenantId}` : Prisma.empty}
            GROUP BY a."userId"
        `

        const userStats = await prisma.$queryRaw<{ userId: string, present: number, late: number, total: number }[]>(query)

        if (userStats.length === 0) return []

        const users = await prisma.user.findMany({
            where: { id: { in: userStats.map(s => s.userId) } },
            select: {
                id: true,
                siteId: true,
                departmentId: true,
                sites: { select: { name: true } },
                departments: { select: { name: true } }
            }
        })

        const groupMap = new Map<string, { id: string, name: string, present: number, late: number, total: number }>()

        userStats.forEach(stat => {
            const user = users.find(u => u.id === stat.userId)
            if (!user) return

            const groupId = groupBy === 'site' ? user.siteId : user.departmentId
            const groupName = groupBy === 'site' ? user.sites?.name : user.departments?.name

            if (!groupId) return

            if (!groupMap.has(groupId)) {
                groupMap.set(groupId, { id: groupId, name: groupName || 'Unknown', present: 0, late: 0, total: 0 })
            }

            const g = groupMap.get(groupId)!
            g.present += stat.present
            g.late += stat.late
            g.total += stat.total
        })

        return Array.from(groupMap.values())
    }

    async getTopEmployees(startDate: Date, endDate: Date, limit: number = 5, siteId?: string, departmentId?: string) {
        let userIds: string[] | undefined = undefined
        if (siteId || departmentId) {
            const users = await prisma.user.findMany({
                where: {
                    ...(siteId && { siteId }),
                    ...(departmentId && { departmentId })
                },
                select: { id: true }
            })
            userIds = users.map(u => u.id)
            if (userIds.length === 0) return []
        }

        const where: Prisma.AttendanceWhereInput = {
            checkIn: { gte: startDate, lte: endDate },
            status: { in: ['ON_TIME', 'LATE'] },
            ...(userIds !== undefined && { userId: { in: userIds } })
        }

        const groups = await prisma.attendance.groupBy({
            by: ['userId'],
            where,
            _count: { _all: true }
        })

        groups.sort((a, b) => b._count._all - a._count._all)
        const topIds = groups.slice(0, limit)

        if (topIds.length === 0) return []

        const users = await prisma.user.findMany({
            where: { id: { in: topIds.map(g => g.userId) } },
            select: { id: true, name: true, image: true, sites: { select: { name: true } }, departments: { select: { name: true } } }
        })

        return topIds.map(g => {
            const user = users.find(u => u.id === g.userId)
            return {
                user,
                count: g._count._all
            }
        }).filter(item => item.user != null)
    }

    async getTopAbsentees(startDate: Date, endDate: Date, limit: number = 5, siteId?: string, departmentId?: string) {
        let userIds: string[] | undefined = undefined
        const usersMatch = await prisma.user.findMany({
            where: {
                workingHourMode: { not: 'FLEXIBLE' },
                ...(siteId && { siteId }),
                ...(departmentId && { departmentId })
            },
            select: { id: true }
        })
        userIds = usersMatch.map(u => u.id)
        if (userIds.length === 0) return []

        const where: Prisma.AttendanceWhereInput = {
            checkIn: { gte: startDate, lte: endDate },
            status: { in: ['ALPHA', 'ABSENT'] },
            userId: { in: userIds }
        }

        const groups = await prisma.attendance.groupBy({
            by: ['userId'],
            where,
            _count: { _all: true }
        })

        groups.sort((a, b) => b._count._all - a._count._all)
        const topIds = groups.slice(0, limit)

        if (topIds.length === 0) return []

        const users = await prisma.user.findMany({
            where: { id: { in: topIds.map(g => g.userId) } },
            select: { id: true, name: true, image: true, sites: { select: { name: true } }, departments: { select: { name: true } } }
        })

        return topIds.map(g => {
            const user = users.find(u => u.id === g.userId)
            return {
                user,
                count: g._count._all
            }
        }).filter(item => item.user != null)
    }

    async getUserAttendanceStats(startDate: Date, endDate: Date, siteId?: string, departmentId?: string) {
        let userIds: string[] | undefined = undefined
        if (siteId || departmentId) {
            const users = await prisma.user.findMany({
                where: {
                    ...(siteId && { siteId }),
                    ...(departmentId && { departmentId })
                },
                select: { id: true }
            })
            userIds = users.map(u => u.id)
            if (userIds.length === 0) return []
        }

        const where: Prisma.AttendanceWhereInput = {
            checkIn: { gte: startDate, lte: endDate },
            status: { in: ['ON_TIME', 'LATE'] },
            ...(userIds !== undefined && { userId: { in: userIds } })
        }

        return prisma.attendance.groupBy({
            by: ['userId'],
            where,
            _count: { _all: true }
        })
    }

    async getUserAbsenceStats(startDate: Date, endDate: Date, siteId?: string, departmentId?: string) {
        const usersMatch = await prisma.user.findMany({
            where: {
                workingHourMode: { not: 'FLEXIBLE' },
                ...(siteId && { siteId }),
                ...(departmentId && { departmentId })
            },
            select: { id: true }
        })
        const userIds = usersMatch.map(u => u.id)
        if (userIds.length === 0) return []

        const where: Prisma.AttendanceWhereInput = {
            checkIn: { gte: startDate, lte: endDate },
            status: { in: ['ALPHA', 'ABSENT'] },
            userId: { in: userIds }
        }

        return prisma.attendance.groupBy({
            by: ['userId'],
            where,
            _count: { _all: true }
        })
    }

    async getUserAttendanceRecords(startDate: Date, endDate: Date, siteId?: string, departmentId?: string) {
        let userIds: string[] | undefined = undefined
        if (siteId || departmentId) {
            const users = await prisma.user.findMany({
                where: {
                    ...(siteId && { siteId }),
                    ...(departmentId && { departmentId })
                },
                select: { id: true }
            })
            userIds = users.map(u => u.id)
            if (userIds.length === 0) return []
        }

        const where: Prisma.AttendanceWhereInput = {
            checkIn: { gte: startDate, lte: endDate },
            status: { in: ['ON_TIME', 'LATE'] },
            ...(userIds !== undefined && { userId: { in: userIds } })
        }

        return prisma.attendance.findMany({
            where,
            select: {
                userId: true,
                notes: true,
                status: true
            }
        })
    }

    async getUserTotalDuration(startDate: Date, endDate: Date, siteId?: string, departmentId?: string) {
        const { tenantId, isSuperAdmin } = await getTenantIdFromContext()
        const effectiveTenantId = (!isSuperAdmin && !tenantId) ? '___MISSING_TENANT_ID___' : tenantId

        let userIds: string[] | undefined = undefined
        if (siteId || departmentId) {
            const users = await prisma.user.findMany({
                where: {
                    ...(siteId && { siteId }),
                    ...(departmentId && { departmentId })
                },
                select: { id: true }
            })
            userIds = users.map(u => u.id)
            if (userIds.length === 0) return new Map<string, number>()
        }

        let query = Prisma.sql`
            SELECT
                a."userId",
                SUM(EXTRACT(EPOCH FROM (a."checkOut" - a."checkIn")) / 60)::float as "totalMinutes"
            FROM "Attendance" a
            WHERE a."checkIn" >= ${startDate}
            AND a."checkIn" <= ${endDate}
            AND a."checkOut" IS NOT NULL
            AND a.status IN ('ON_TIME', 'LATE')
        `

        if (!isSuperAdmin) {
            query = Prisma.sql`${query} AND a."tenantId" = ${effectiveTenantId}`
        }

        if (userIds !== undefined) {
            query = Prisma.sql`${query} AND a."userId" IN (${Prisma.join(userIds)})`
        }

        query = Prisma.sql`${query} GROUP BY a."userId"`

        const results = await prisma.$queryRaw<{ userId: string, totalMinutes: number }[]>(query)

        const userDurationMap = new Map<string, number>()
        results.forEach((r: { userId: string, totalMinutes: number }) => {
            userDurationMap.set(r.userId, r.totalMinutes || 0)
        })

        return userDurationMap
    }

    async getUserLateStats(startDate: Date, endDate: Date, siteId?: string, departmentId?: string) {
        let userIds: string[] | undefined = undefined
        if (siteId || departmentId) {
            const users = await prisma.user.findMany({
                where: {
                    ...(siteId && { siteId }),
                    ...(departmentId && { departmentId })
                },
                select: { id: true }
            })
            userIds = users.map(u => u.id)
            if (userIds.length === 0) return []
        }

        const where: Prisma.AttendanceWhereInput = {
            checkIn: { gte: startDate, lte: endDate },
            status: 'LATE',
            ...(userIds !== undefined && { userId: { in: userIds } })
        }

        return prisma.attendance.groupBy({
            by: ['userId'],
            where,
            _count: { _all: true }
        })
    }

    async findAllOpenSessionsWithUser(endOfToday: Date, twentyFourHoursAgo: Date) {
        return prisma.attendance.findMany({
            where: {
                checkOut: null,
                checkIn: {
                    lte: endOfToday
                },
                status: {
                    not: 'ALPHA'
                },
                OR: [
                    {
                        user: {
                            workingHourMode: {
                                not: 'FLEXIBLE'
                            }
                        }
                    },
                    {
                        user: {
                            workingHourMode: 'FLEXIBLE'
                        },
                        checkIn: {
                            lte: twentyFourHoursAgo
                        }
                    }
                ]
            },
            include: {
                user: {
                    select: {
                        name: true,
                        workingHourMode: true,
                        startWorkTime: true,
                        endWorkTime: true,
                        shift: true
                    }
                }
            }
        })
    }

    async update(id: string, data: Prisma.AttendanceUpdateInput) {
        return prisma.attendance.update({
            where: { id },
            data
        })
    }

    async create(data: Prisma.AttendanceUncheckedCreateInput) {
        return prisma.attendance.create({
            data
        })
    }

    async findFirstByUserAndDateRange(userId: string, tenantId: string, startOfDay: Date, endOfDay: Date) {
        return prisma.attendance.findFirst({
            where: {
                userId,
                tenantId,
                checkIn: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            }
        })
    }

    async findCheckedInUserIds(startOfDay: Date, endOfDay: Date) {
        const results = await prisma.attendance.findMany({
            where: {
                checkIn: { gte: startOfDay, lte: endOfDay }
            },
            select: { userId: true }
        })
        return results
    }

    async findIncompleteCheckOutWithUser(startOfDay: Date, endOfDay: Date) {
        return prisma.attendance.findMany({
            where: {
                checkIn: { gte: startOfDay, lte: endOfDay },
                checkOut: null,
                status: { notIn: ['ALPHA', 'ABSENT'] },
                user: {
                    isActive: true,
                    pushToken: { not: null },
                    endWorkTime: { not: null },
                    workingHourMode: { not: 'FLEXIBLE' }
                }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        startWorkTime: true,
                        endWorkTime: true,
                        workDays: true,
                        pushToken: true
                    }
                }
            },
            distinct: ['userId']
        })
    }

    async findIncompleteCheckOutSelect(startOfDay: Date, endOfDay: Date) {
        return prisma.attendance.findMany({
            where: {
                checkIn: { gte: startOfDay, lte: endOfDay },
                checkOut: null,
                status: { notIn: ['ALPHA', 'ABSENT'] },
                user: {
                    workingHourMode: { not: 'FLEXIBLE' }
                }
            },
            select: { userId: true, user: { select: { name: true } } }
        })
    }

    async findActiveFlexibleSessionsWithUser() {
        return prisma.attendance.findMany({
            where: {
                checkOut: null,
                user: {
                    isActive: true,
                    pushToken: { not: null },
                    workingHourMode: 'FLEXIBLE'
                }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        flexibleTargetHour: true,
                        pushToken: true
                    }
                }
            }
        })
    }

    async createWithId(data: {
        id: string
        userId: string
        tenantId: string
        checkIn: Date
        status: AttendanceStatus
        notes: string
        location: string
        updatedAt: Date
    }) {
        return prisma.attendance.create({
            data: {
                id: data.id,
                userId: data.userId,
                tenantId: data.tenantId,
                checkIn: data.checkIn,
                status: data.status,
                notes: data.notes,
                location: data.location,
                updatedAt: data.updatedAt
            }
        })
    }

    async deleteMany(where: Prisma.AttendanceWhereInput) {
        return prisma.attendance.deleteMany({ where })
    }

    async findFirstOpenSession(params: {
        userId: string
        tenantId?: string
    }) {
        return prisma.attendance.findFirst({
            where: {
                userId: params.userId,
                checkOut: null,
                ...(params.tenantId && { tenantId: params.tenantId })
            },
            orderBy: { checkIn: 'desc' },
            include: {
                user: {
                    select: {
                        workingHourMode: true,
                        flexibleTargetHour: true,
                        shift: {
                            select: {
                                startTime: true,
                                endTime: true,
                            }
                        }
                    }
                }
            }
        })
    }

    async findManyStaleSessions(params: {
        userId: string
        effectiveToday: Date
        tenantId?: string
    }) {
        return prisma.attendance.findMany({
            where: {
                userId: params.userId,
                checkOut: null,
                status: { not: 'ALPHA' },
                checkIn: { lt: params.effectiveToday },
                ...(params.tenantId && { tenantId: params.tenantId })
            }
        })
    }

    async findFirstActiveForCheckout(params: {
        userId: string
        tenantId?: string
    }) {
        return prisma.attendance.findFirst({
            where: {
                userId: params.userId,
                checkOut: null,
                ...(params.tenantId && { tenantId: params.tenantId })
            },
            orderBy: { checkIn: 'desc' },
            include: {
                user: {
                    select: {
                        workingHourMode: true,
                        attendanceGeofencePolicy: true,
                        flexibleTargetHour: true,
                        name: true
                    }
                }
            }
        })
    }

    async findFirstForCurrentStatus(params: {
        userId: string
        tenantId?: string
    }) {
        return prisma.attendance.findFirst({
            where: {
                userId: params.userId,
                ...(params.tenantId ? { tenantId: params.tenantId } : {})
            },
            orderBy: { checkIn: 'desc' },
            select: {
                id: true,
                checkIn: true,
                checkOut: true,
                status: true,
                user: {
                    select: {
                        workingHourMode: true,
                        flexibleTargetHour: true,
                        shift: {
                            select: {
                                startTime: true,
                                endTime: true
                            }
                        }
                    }
                }
            }
        })
    }

    async findManyForHistory(params: {
        userId: string
        skip: number
        take: number
    }) {
        return prisma.attendance.findMany({
            where: { userId: params.userId },
            orderBy: { checkIn: 'desc' },
            take: params.take,
            skip: params.skip
        })
    }

    async countByUserId(userId: string) {
        return prisma.attendance.count({ where: { userId } })
    }

    async findManyForAnalytics(params: {
        userId: string
        startDate: Date
        endDate: Date
    }) {
        return prisma.attendance.findMany({
            where: {
                userId: params.userId,
                checkIn: { gte: params.startDate, lte: params.endDate }
            },
            orderBy: { checkIn: 'desc' }
        })
    }
}
