import { AttendanceRepository } from '../repositories/AttendanceRepository'
import { OvertimeRepository } from '../../overtime/repositories/OvertimeRepository'
import { prisma } from '@/lib/prisma'

export class AttendanceService {
    private repository: AttendanceRepository
    private overtimeRepository: OvertimeRepository

    constructor() {
        this.repository = new AttendanceRepository()
        this.overtimeRepository = new OvertimeRepository()
    }

    async getReportData(startDate: Date, endDate: Date, siteId?: string, departmentId?: string) {
        const [stats, dailyStats, groupedBySite, groupedByDept, topEmployees] = await Promise.all([
            this.repository.getStatsByDateRange(startDate, endDate, siteId, departmentId),
            this.repository.getDailyStats(startDate, endDate, siteId, departmentId),
            this.repository.getGroupedStats(startDate, endDate, 'site'),
            this.repository.getGroupedStats(startDate, endDate, 'department'),
            this.repository.getTopEmployees(startDate, endDate, 5, siteId, departmentId)
        ])

        return {
            summary: {
                totalAttendance: stats.total,
                onTimeCount: (stats.statusCounts['ON_TIME'] || 0),
                lateCount: (stats.statusCounts['LATE'] || 0),
                sickCount: (stats.statusCounts['SICK'] || 0),
                attendanceRate: stats.total > 0 ? 100 : 0,
                lateRate: stats.total > 0 ? ((stats.statusCounts['LATE'] || 0) / stats.total) * 100 : 0
            },
            trends: dailyStats,
            bySite: groupedBySite,
            byDepartment: groupedByDept,
            topEmployees,
            combinedTopEmployees: await this.getCombinedTopEmployees(startDate, endDate, 5, siteId, departmentId)
        }
    }

    async getCombinedTopEmployees(startDate: Date, endDate: Date, limit: number = 5, siteId?: string, departmentId?: string) {
        // Fetch raw aggregates
        const [attendanceStats, overtimeStats] = await Promise.all([
            this.repository.getUserAttendanceStats(startDate, endDate, siteId, departmentId),
            this.overtimeRepository.getUserOvertimeStats(startDate, endDate, siteId, departmentId)
        ])

        // Merge Map
        const userScores = new Map<string, { days: number, otMinutes: number, score: number }>()

        // Process Attendance (1 Day = 10 Points)
        attendanceStats.forEach(stat => {
            if (!userScores.has(stat.userId)) {
                userScores.set(stat.userId, { days: 0, otMinutes: 0, score: 0 })
            }
            const entry = userScores.get(stat.userId)!
            entry.days = stat._count._all
            entry.score += (entry.days * 10)
        })

        // Process Overtime (1 Hour = 1 Point => 60 Mins = 1 Point => 1 Min = 1/60 Point)
        overtimeStats.forEach(stat => {
            if (!userScores.has(stat.userId)) {
                // Only consider overtime if user exists in attendance? No, maybe OT only user? 
                // Usually logic implies active employee. We'll include all.
                userScores.set(stat.userId, { days: 0, otMinutes: 0, score: 0 })
            }
            const entry = userScores.get(stat.userId)!
            const minutes = stat._sum.duration || 0
            entry.otMinutes = minutes
            entry.score += (minutes / 60) * 1 // 1 Point per hour
        })

        // Sort by Score Desc
        const sorted = Array.from(userScores.entries()).sort((a, b) => b[1].score - a[1].score)
        const top = sorted.slice(0, limit)

        if (top.length === 0) return []

        // Fetch User Details
        const users = await prisma.user.findMany({
            where: { id: { in: top.map(t => t[0]) } },
            select: { id: true, name: true, image: true, sites: { select: { name: true } }, departments: { select: { name: true } } }
        })

        return top.map(t => {
            const userId = t[0]
            const stats = t[1]
            const user = users.find(u => u.id === userId)
            if (!user) return null
            return {
                user,
                score: Math.round(stats.score), // Round score for display
                details: {
                    days: stats.days,
                    otHours: (stats.otMinutes / 60).toFixed(1)
                }
            }
        }).filter(item => item !== null)
    }
}
