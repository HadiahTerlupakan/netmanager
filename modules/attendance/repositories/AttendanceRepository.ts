import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { HolidayRepository } from './HolidayRepository'
import { getTenantIdFromContext } from '@/lib/tenant-context'

export class AttendanceRepository {
    async findMany(params: {
        skip?: number
        take?: number
        where?: Prisma.AttendanceWhereInput
        orderBy?: Prisma.AttendanceOrderByWithRelationInput
        include?: Prisma.AttendanceInclude
    }) {
        return prisma.attendance.findMany(params)
    }

    async count(where?: Prisma.AttendanceWhereInput) {
        return prisma.attendance.count({
            ...(where ? { where } : {})
        })
    }

    async getStatsByDateRange(startDate: Date, endDate: Date, siteId?: string, departmentId?: string) {
        // 1. Status Counts
        // Use user ID filtering instead of JOIN to User table
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
            
            // Short-circuit if no users match filters
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

        // 2. Average Duration (Optimized)
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
        // 1. Get Attendance Stats
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
            
            // Short-circuit if no users match filters
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

        // 2. Get Leave Stats
        // ... (rest of the method stays mostly same, but update leaveWhere)
        const holidayRepo = new HolidayRepository()
        const holidays = await holidayRepo.findMany({
            where: { date: { gte: startDate, lte: endDate } }
        })
        const holidaySet = new Set<string>(holidays.map((h: { date: Date }) => h.date.toISOString().split('T')[0]))

        // Fetch Leaves
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

        // Merge Data
        const dailyMap = new Map<string, { present: number, late: number, absent: number, isHoliday: boolean, sakit: number, cuti: number, izin: number }>()

        // Helper
        const ensureDate = (dateKey: string) => {
            if (!dailyMap.has(dateKey)) {
                dailyMap.set(dateKey, { present: 0, late: 0, absent: 0, isHoliday: holidaySet.has(dateKey), sakit: 0, cuti: 0, izin: 0 })
            }
            return dailyMap.get(dateKey)!
        }

        // Fill from SQL Attendance Stats
        attendanceStats.forEach((stat: { date: string, present: number, late: number }) => {
            const d = ensureDate(stat.date)
            d.present = stat.present
            d.late = stat.late
        })

        // Fill Holidays
        holidaySet.forEach((date: string) => {
            if(date) ensureDate(date)
        })

        // Fill Leaves (JS Expansion)
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

        // 1. Get attendance stats grouped by userId
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

        // 2. Fetch Users with their site or department info
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

        // 3. Aggregate in memory
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

        // Group by User
        const groups = await prisma.attendance.groupBy({
            by: ['userId'],
            where,
            _count: { _all: true }
        })

        // Sort by count desc
        groups.sort((a, b) => b._count._all - a._count._all)
        const topIds = groups.slice(0, limit)

        if (topIds.length === 0) return []

        // Fetch User Details
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
            status: 'ALPHA',
            userId: { in: userIds }
        }

        const groups = await prisma.attendance.groupBy({
            by: ['userId'],
            where,
            _count: { _all: true }
        })

        // Sort by count desc
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
            status: 'ALPHA',
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
}
