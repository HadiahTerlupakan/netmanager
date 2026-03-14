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
        // Use raw query to ensure we capture filtering correctly if it wasn't working before with Prisma types
        // But Prisma groupBy supports relations in where clause usually.
        // Let's stick to Prisma for simple counts if it works, BUT we need consistency.
        // If we switch to raw for AVG, might as well use raw for everything to avoid mixing logic or just use raw for AVG.
        // Let's use raw for AVG only as it is the heavy part.

        const where: Prisma.AttendanceWhereInput = {
            checkIn: { gte: startDate, lte: endDate }
        }
        if (siteId || departmentId) {
            where.user = {
                ...(siteId && { siteId }),
                ...(departmentId && { departmentId })
            }
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
        `

        if (siteId || departmentId) {
            query = Prisma.sql`${query} JOIN "User" u ON a."userId" = u.id`
        }

        query = Prisma.sql`${query} 
            WHERE a."checkIn" >= ${startDate}
            AND a."checkIn" <= ${endDate}
            AND a."checkOut" IS NOT NULL
        `

        if (!isSuperAdmin) {
            query = Prisma.sql`${query} AND a."tenantId" = ${effectiveTenantId}`
        }

        if (siteId) {
            query = Prisma.sql`${query} AND u."siteId" = ${siteId}`
        }
        if (departmentId) {
            query = Prisma.sql`${query} AND u."departmentId" = ${departmentId}`
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

        let query = Prisma.sql`
            SELECT
                TO_CHAR(a."checkIn", 'YYYY-MM-DD') as date,
                COUNT(CASE WHEN a.status IN ('ON_TIME', 'LATE') THEN 1 END)::int as present,
                COUNT(CASE WHEN a.status = 'LATE' THEN 1 END)::int as late
            FROM "Attendance" a
        `

        if (siteId || departmentId) {
            query = Prisma.sql`${query} JOIN "User" u ON a."userId" = u.id`
        }

        query = Prisma.sql`${query} 
            WHERE a."checkIn" >= ${startDate}
            AND a."checkIn" <= ${endDate}
        `

        if (!isSuperAdmin) {
            query = Prisma.sql`${query} AND a."tenantId" = ${effectiveTenantId}`
        }

        if (siteId) {
            query = Prisma.sql`${query} AND u."siteId" = ${siteId}`
        }
        if (departmentId) {
            query = Prisma.sql`${query} AND u."departmentId" = ${departmentId}`
        }

        query = Prisma.sql`${query} GROUP BY TO_CHAR(a."checkIn", 'YYYY-MM-DD')`

        const attendanceStats = await prisma.$queryRaw<{ date: string, present: number, late: number }[]>(query)

        // 2. Get Leave Stats
        // Note: Leaves can span multiple days, so simple group by start date isn't enough for daily stats if we want to show "people on leave today"
        // But for "Daily Stats" chart usually we just count new leaves starting that day OR expanding ranges.
        // Expanding ranges in SQL is complex (generate_series).
        // For now, let's keep the existing logic for leaves (JS expansion) as it's usually lower volume than attendance.
        // Or we can optimize if needed. Let's stick to hybrid: Optimized Attendance (High Vol) + JS Leave (Low Vol).

        // Fetch Holidays (Low Vol)
        const holidayRepo = new HolidayRepository()
        const holidays = await holidayRepo.findMany({
            where: { date: { gte: startDate, lte: endDate } }
        })
        const holidaySet = new Set<string>(holidays.map((h: { date: Date }) => h.date.toISOString().split('T')[0]))

        // Fetch Leaves (Low/Med Vol)
        const leaveWhere: Prisma.LeaveRequestWhereInput = {
            status: 'APPROVED',
            startDate: { lte: endDate },
            endDate: { gte: startDate }
        }
        if (siteId || departmentId) {
            leaveWhere.user = {
                ...(siteId && { siteId }),
                ...(departmentId && { departmentId })
            }
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
        let groupByColumn = Prisma.sql``
        let groupByNameColumn = Prisma.sql``
        let joinTable = Prisma.sql``

        if (groupBy === 'site') {
            groupByColumn = Prisma.sql`u."siteId"`
            joinTable = Prisma.sql`JOIN "sites" s ON u."siteId" = s.id`
            groupByNameColumn = Prisma.sql`s.name`
        } else {
            groupByColumn = Prisma.sql`u."departmentId"`
            joinTable = Prisma.sql`JOIN "departments" d ON u."departmentId" = d.id`
            groupByNameColumn = Prisma.sql`d.name`
        }

        // Raw query to aggregate by joined table
        const { tenantId, isSuperAdmin } = await getTenantIdFromContext()
        const effectiveTenantId = (!isSuperAdmin && !tenantId) ? '___MISSING_TENANT_ID___' : tenantId

        const query = Prisma.sql`
            SELECT
                ${groupByColumn} as id,
                ${groupByNameColumn} as name,
                COUNT(CASE WHEN a.status IN ('ON_TIME', 'LATE') THEN 1 END)::int as present,
                COUNT(CASE WHEN a.status = 'LATE' THEN 1 END)::int as late,
                COUNT(*)::int as total
            FROM "Attendance" a
            JOIN "User" u ON a."userId" = u.id
            ${joinTable}
            WHERE a."checkIn" >= ${startDate}
            AND a."checkIn" <= ${endDate}
            ${!isSuperAdmin ? Prisma.sql`AND a."tenantId" = ${effectiveTenantId}` : Prisma.empty}
            GROUP BY ${groupByColumn}, ${groupByNameColumn}
        `

        const stats = await prisma.$queryRaw<{ id: string, name: string, present: number, late: number, total: number }[]>(query)

        return stats
    }

    async getTopEmployees(startDate: Date, endDate: Date, limit: number = 5, siteId?: string, departmentId?: string) {
        const where: Prisma.AttendanceWhereInput = {
            checkIn: { gte: startDate, lte: endDate },
            status: { in: ['ON_TIME', 'LATE'] } // Count present days
        }

        if (siteId || departmentId) {
            where.user = {
                ...(siteId && { siteId }),
                ...(departmentId && { departmentId })
            }
        }

        // Group by User
        const groups = await prisma.attendance.groupBy({
            by: ['userId'],
            where,
            _count: { _all: true },
            orderBy: {
                _count: {
                    userId: 'desc' // Initial sort, but we need count desc. Prisma groupBy orderBy count is supported in newer versions.
                    // Fallback: fetch and sort in memory if needed, but let's try Prisma way or just raw count.
                }
            }
        })

        // Prisma groupBy sorting by aggregation might be tricky in older versions or specific DBs without preview features.
        // Safer approach: Fetch aggregated, then sort js, then populate user info.

        // Sort by count desc
        groups.sort((a: { _count: { _all: number } }, b: { _count: { _all: number } }) => b._count._all - a._count._all)
        const topIds = groups.slice(0, limit)

        // Fetch User Details
        const users = await prisma.user.findMany({
            where: { id: { in: topIds.map((g: { userId: string }) => g.userId) } },
            select: { id: true, name: true, image: true, sites: { select: { name: true } }, departments: { select: { name: true } } }
        })

        return topIds.map((g: { userId: string, _count: { _all: number } }) => {
            const user = users.find((u: { id: string }) => u.id === g.userId)
            return {
                user,
                count: g._count._all
            }
        }).filter((item: { user: { id: string } | undefined }) => item.user != null)
    }

    async getTopAbsentees(startDate: Date, endDate: Date, limit: number = 5, siteId?: string, departmentId?: string) {
        // Build user filter - always exclude FLEXIBLE
        const userFilter: Prisma.UserWhereInput = {
            workingHourMode: { not: 'FLEXIBLE' },
            ...(siteId && { siteId }),
            ...(departmentId && { departmentId })
        }

        const where: Prisma.AttendanceWhereInput = {
            checkIn: { gte: startDate, lte: endDate },
            status: 'ALPHA',
            // IMPORTANT: Exclude FLEXIBLE users - they should never have ALPHA status
            user: userFilter
        }

        const groups = await prisma.attendance.groupBy({
            by: ['userId'],
            where,
            _count: { _all: true }
        })

        // Sort by count desc
        groups.sort((a: { _count: { _all: number } }, b: { _count: { _all: number } }) => b._count._all - a._count._all)
        const topIds = groups.slice(0, limit)

        const users = await prisma.user.findMany({
            where: { id: { in: topIds.map((g: { userId: string }) => g.userId) } },
            select: { id: true, name: true, image: true, sites: { select: { name: true } }, departments: { select: { name: true } } }
        })

        return topIds.map((g: { userId: string, _count: { _all: number } }) => {
            const user = users.find((u: { id: string }) => u.id === g.userId)
            return {
                user,
                count: g._count._all
            }
        }).filter((item: { user: { id: string } | undefined }) => item.user != null)
    }

    async getUserAttendanceStats(startDate: Date, endDate: Date, siteId?: string, departmentId?: string) {
        const where: Prisma.AttendanceWhereInput = {
            checkIn: { gte: startDate, lte: endDate },
            status: { in: ['ON_TIME', 'LATE'] }
        }

        if (siteId || departmentId) {
            where.user = {
                ...(siteId && { siteId }),
                ...(departmentId && { departmentId })
            }
        }

        return prisma.attendance.groupBy({
            by: ['userId'],
            where,
            _count: { _all: true }
        })
    }

    async getUserAbsenceStats(startDate: Date, endDate: Date, siteId?: string, departmentId?: string) {
        // Build user filter - always exclude FLEXIBLE
        const userFilter: Prisma.UserWhereInput = {
            workingHourMode: { not: 'FLEXIBLE' },
            ...(siteId && { siteId }),
            ...(departmentId && { departmentId })
        }

        const where: Prisma.AttendanceWhereInput = {
            checkIn: { gte: startDate, lte: endDate },
            status: 'ALPHA',
            // IMPORTANT: Exclude FLEXIBLE users - they should never have ALPHA status
            user: userFilter
        }

        return prisma.attendance.groupBy({
            by: ['userId'],
            where,
            _count: { _all: true }
        })
    }

    async getUserAttendanceRecords(startDate: Date, endDate: Date, siteId?: string, departmentId?: string) {
        const where: Prisma.AttendanceWhereInput = {
            checkIn: { gte: startDate, lte: endDate },
            status: { in: ['ON_TIME', 'LATE'] }
        }

        if (siteId || departmentId) {
            where.user = {
                ...(siteId && { siteId }),
                ...(departmentId && { departmentId })
            }
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

        let query = Prisma.sql`
            SELECT
                a."userId",
                SUM(EXTRACT(EPOCH FROM (a."checkOut" - a."checkIn")) / 60)::float as "totalMinutes"
            FROM "Attendance" a
        `

        if (siteId || departmentId) {
            query = Prisma.sql`${query} JOIN "User" u ON a."userId" = u.id`
        }

        query = Prisma.sql`${query} 
            WHERE a."checkIn" >= ${startDate}
            AND a."checkIn" <= ${endDate}
            AND a."checkOut" IS NOT NULL
            AND a.status IN ('ON_TIME', 'LATE')
        `

        if (!isSuperAdmin) {
            query = Prisma.sql`${query} AND a."tenantId" = ${effectiveTenantId}`
        }

        if (siteId) {
            query = Prisma.sql`${query} AND u."siteId" = ${siteId}`
        }
        if (departmentId) {
            query = Prisma.sql`${query} AND u."departmentId" = ${departmentId}`
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
        const where: Prisma.AttendanceWhereInput = {
            checkIn: { gte: startDate, lte: endDate },
            status: 'LATE'
        }

        if (siteId || departmentId) {
            where.user = {
                ...(siteId && { siteId }),
                ...(departmentId && { departmentId })
            }
        }

        return prisma.attendance.groupBy({
            by: ['userId'],
            where,
            _count: { _all: true }
        })
    }
}
