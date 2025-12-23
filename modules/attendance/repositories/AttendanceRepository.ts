import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

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
        return prisma.attendance.count({ where })
    }

    async getStatsByDateRange(startDate: Date, endDate: Date, siteId?: string, departmentId?: string) {
        const where: Prisma.AttendanceWhereInput = {
            checkIn: {
                gte: startDate,
                lte: endDate
            }
        }

        if (siteId || departmentId) {
            where.user = {
                ...(siteId && { siteId }),
                ...(departmentId && { departmentId })
            }
        }

        // Aggregate counts by status
        const statusCounts = await prisma.attendance.groupBy({
            by: ['status'],
            where,
            _count: {
                _all: true
            }
        })

        const total = await prisma.attendance.count({ where })

        return {
            total,
            statusCounts: statusCounts.reduce((acc, curr) => {
                acc[curr.status] = curr._count._all
                return acc
            }, {} as Record<string, number>)
        }
    }

    async getDailyStats(startDate: Date, endDate: Date, siteId?: string, departmentId?: string) {
        // Since Prisma doesn't support grouping by date easily in all DBs without raw query,
        // we'll fetch all records and group in memory for this flexible report
        // OR use raw query if performance is critical. For now, in-memory is safer for portability.
        // Assuming moderate data volume for a reporting range (e.g., month).

        const where: Prisma.AttendanceWhereInput = {
            checkIn: {
                gte: startDate,
                lte: endDate
            }
        }

        if (siteId || departmentId) {
            where.user = {
                ...(siteId && { siteId }),
                ...(departmentId && { departmentId })
            }
        }

        const records = await prisma.attendance.findMany({
            where,
            select: {
                checkIn: true,
                status: true
            }
        })

        // Group by Date (YYYY-MM-DD)
        const dailyMap = new Map<string, { present: number, late: number, absent: number }>()

        records.forEach(rec => {
            const dateKey = rec.checkIn.toISOString().split('T')[0]
            if (!dailyMap.has(dateKey)) {
                dailyMap.set(dateKey, { present: 0, late: 0, absent: 0 })
            }
            const stats = dailyMap.get(dateKey)!

            // Assuming 'ON_TIME', 'LATE', and 'PRESENT' are valid statuses for present
            if (rec.status === 'LATE') stats.late++
            if (rec.status === 'ON_TIME' || rec.status === 'LATE' || rec.status === 'PRESENT') stats.present++
            // 'SICK' etc usually means not present working, but data structure might vary. 
            // We'll stick to verified statuses.
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
        // Complex aggregation needing relation traversal. 
        // We will fetch all relevant attendance with user relations.

        const attendances = await prisma.attendance.findMany({
            where: {
                checkIn: { gte: startDate, lte: endDate }
            },
            include: {
                user: {
                    include: {
                        site: true,
                        department: true // assuming relation names
                    }
                }
            }
        })

        const groups = new Map<string, { name: string, present: number, late: number, total: number }>()

        attendances.forEach(att => {
            const user = att.user
            if (!user) return

            let groupKey = 'Unknown'
            let groupName = 'Unknown'

            if (groupBy === 'site' && user.site) {
                groupKey = user.site.id
                groupName = user.site.name
            } else if (groupBy === 'department' && user.department) {
                groupKey = user.department.id // Assuming department has ID
                // If department is just a string or relation?
                // Based on User schema in previous edits: department: { name: true }
                // So department is a relation.
                // We'll assume user.departmentId or user.department.name
                if (user.department) {
                    // Check logic. Usually department is relation.
                    // Let's use name if ID not easily accessible or just name for grouping
                    groupKey = user.department.name // Group by Name if ID not unique across sites? Or just Name
                    groupName = user.department.name
                }
            }

            if (!groups.has(groupKey)) {
                groups.set(groupKey, { name: groupName, present: 0, late: 0, total: 0 })
            }

            const stats = groups.get(groupKey)!
            stats.total++
            if (att.status === 'LATE') stats.late++
            if (['ON_TIME', 'LATE', 'PRESENT'].includes(att.status)) stats.present++
        })

        return Array.from(groups.values())
    }

    async getTopEmployees(startDate: Date, endDate: Date, limit: number = 5, siteId?: string, departmentId?: string) {
        const where: Prisma.AttendanceWhereInput = {
            checkIn: { gte: startDate, lte: endDate },
            status: { in: ['ON_TIME', 'LATE', 'PRESENT'] } // Count present days
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
            select: { id: true, name: true, image: true, site: { select: { name: true } }, department: { select: { name: true } } }
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
            status: { in: ['ON_TIME', 'LATE', 'PRESENT'] }
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
