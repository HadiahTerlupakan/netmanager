import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { HolidayRepository } from './HolidayRepository'

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
        const startStr = startDate.toISOString()
        const endStr = endDate.toISOString()

        let userJoin = ''
        let userCondition = ''

        if (siteId || departmentId) {
            userJoin = 'JOIN "users" u ON a."userId" = u.id'
            const conditions = []
            if (siteId) conditions.push(`u."siteId" = '${siteId}'`)
            if (departmentId) conditions.push(`u."departmentId" = '${departmentId}'`)
            if (conditions.length > 0) {
                userCondition = 'AND ' + conditions.join(' AND ')
            }
        }

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
        const avgResult = await prisma.$queryRawUnsafe<{ avgDuration: number }[]>(`
            SELECT
                AVG(EXTRACT(EPOCH FROM (a."checkOut" - a."checkIn")) / 60)::float as "avgDuration"
            FROM "Attendance" a
            ${userJoin}
            WHERE a."checkIn" >= '${startStr}'::timestamp
            AND a."checkIn" <= '${endStr}'::timestamp
            AND a."checkOut" IS NOT NULL
            ${userCondition}
        `)

        const avgDurationMinutes = avgResult[0]?.avgDuration ? Math.round(avgResult[0].avgDuration) : 0

        return {
            total,
            avgDurationMinutes,
            statusCounts: statusCounts.reduce((acc, curr) => {
                acc[curr.status] = curr._count._all
                return acc
            }, {} as Record<string, number>)
        }
    }

    async getDailyStats(startDate: Date, endDate: Date, siteId?: string, departmentId?: string) {
        // Use raw query for efficient date grouping
        const startStr = startDate.toISOString()
        const endStr = endDate.toISOString()

        // Build raw query conditions
        let userJoin = ''
        let userCondition = ''

        if (siteId || departmentId) {
            userJoin = 'JOIN "User" u ON a."userId" = u.id'
            const conditions = []
            if (siteId) conditions.push(`u."siteId" = '${siteId}'`)
            if (departmentId) conditions.push(`u."departmentId" = '${departmentId}'`)
            if (conditions.length > 0) {
                userCondition = 'AND ' + conditions.join(' AND ')
            }
        }

        // 1. Get Attendance Stats
        const attendanceStats = await prisma.$queryRawUnsafe<{ date: string, present: number, late: number }[]>(`
            SELECT
                TO_CHAR(a."checkIn", 'YYYY-MM-DD') as date,
                COUNT(CASE WHEN a.status IN ('ON_TIME', 'LATE') THEN 1 END)::int as present,
                COUNT(CASE WHEN a.status = 'LATE' THEN 1 END)::int as late
            FROM "Attendance" a
            ${userJoin}
            WHERE a."checkIn" >= '${startStr}'::timestamp
            AND a."checkIn" <= '${endStr}'::timestamp
            ${userCondition}
            GROUP BY TO_CHAR(a."checkIn", 'YYYY-MM-DD')
        `)

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
        const holidaySet = new Set(holidays.map((h: { date: Date }) => h.date.toISOString().split('T')[0]))

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
        attendanceStats.forEach(stat => {
            const d = ensureDate(stat.date)
            d.present = stat.present
            d.late = stat.late
        })

        // Fill Holidays
        holidaySet.forEach(date => {
            if(date) ensureDate(date)
        })

        // Fill Leaves (JS Expansion)
        leaves.forEach(leave => {
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
        const startStr = startDate.toISOString()
        const endStr = endDate.toISOString()

        let groupByColumn = ''
        let groupByNameColumn = ''
        let joinTable = ''

        if (groupBy === 'site') {
            groupByColumn = 'u."siteId"'
            joinTable = 'JOIN "sites" s ON u."siteId" = s.id'
            groupByNameColumn = 's.name'
        } else {
            groupByColumn = 'u."departmentId"'
            joinTable = 'JOIN "departments" d ON u."departmentId" = d.id'
            groupByNameColumn = 'd.name'
        }

        // Raw query to aggregate by joined table
        const stats = await prisma.$queryRawUnsafe<{ id: string, name: string, present: number, late: number, total: number }[]>(`
            SELECT
                ${groupByColumn} as id,
                ${groupByNameColumn} as name,
                COUNT(CASE WHEN a.status IN ('ON_TIME', 'LATE') THEN 1 END)::int as present,
                COUNT(CASE WHEN a.status = 'LATE' THEN 1 END)::int as late,
                COUNT(*)::int as total
            FROM "Attendance" a
            JOIN "User" u ON a."userId" = u.id
            ${joinTable}
            WHERE a."checkIn" >= '${startStr}'::timestamp
            AND a."checkIn" <= '${endStr}'::timestamp
            GROUP BY ${groupByColumn}, ${groupByNameColumn}
        `)

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
        groups.sort((a, b) => b._count._all - a._count._all)
        const topIds = groups.slice(0, limit)

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
        groups.sort((a, b) => b._count._all - a._count._all)
        const topIds = groups.slice(0, limit)

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
        const startStr = startDate.toISOString()
        const endStr = endDate.toISOString()

        let userJoin = ''
        let userCondition = ''

        if (siteId || departmentId) {
            userJoin = 'JOIN "User" u ON a."userId" = u.id'
            const conditions = []
            if (siteId) conditions.push(`u."siteId" = '${siteId}'`)
            if (departmentId) conditions.push(`u."departmentId" = '${departmentId}'`)
            if (conditions.length > 0) {
                userCondition = 'AND ' + conditions.join(' AND ')
            }
        }

        const results = await prisma.$queryRawUnsafe<{ userId: string, totalMinutes: number }[]>(`
            SELECT
                a."userId",
                SUM(EXTRACT(EPOCH FROM (a."checkOut" - a."checkIn")) / 60)::float as "totalMinutes"
            FROM "Attendance" a
            ${userJoin}
            WHERE a."checkIn" >= '${startStr}'::timestamp
            AND a."checkIn" <= '${endStr}'::timestamp
            AND a."checkOut" IS NOT NULL
            AND a.status IN ('ON_TIME', 'LATE')
            ${userCondition}
            GROUP BY a."userId"
        `)

        const userDurationMap = new Map<string, number>()
        results.forEach(r => {
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
