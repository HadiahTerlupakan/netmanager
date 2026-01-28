import { prisma } from '@/lib/prisma'
import { SalaryRepository } from '../repositories/SalaryRepository'
import { SalaryComponentRepository } from '../repositories/SalaryComponentRepository'
import { AttendanceRepository } from '../../attendance/repositories/AttendanceRepository'
import { OvertimeRepository } from '../../overtime/repositories/OvertimeRepository'
import { LeaveBalanceRepository } from '../../attendance/repositories/LeaveBalanceRepository'
import { 
    SalaryStatus, 
    SalaryComponentType, 
    RateType,
    Prisma,
    EmployeeType
} from '@prisma/client'

interface SalaryCalculationResult {
    userId: string
    month: number
    year: number
    basicSalary: number
    earnings: Array<{ name: string; amount: number; quantity?: number; rate?: number; notes?: string }>
    deductions: Array<{ name: string; amount: number; quantity?: number; rate?: number; notes?: string }>
    totalEarnings: number
    totalDeductions: number
    netSalary: number
}

interface AttendanceStats {
    present: number
    late: number
    absent: number // Alpha
    sick: number
    permit: number
    workDays: number
}

interface OvertimeStats {
    totalMinutes: number
    normalMinutes: number
    holidayMinutes: number
    nationalHolidayMinutes: number
    // Counts for event-based calculation
    normalCount: number
    holidayCount: number
    nationalCount: number
    totalCount: number
}

export class SalaryCalculatorService {
    private salaryRepo: SalaryRepository
    private componentRepo: SalaryComponentRepository
    private attendanceRepo: AttendanceRepository
    private overtimeRepo: OvertimeRepository
    private leaveBalanceRepo: LeaveBalanceRepository

    constructor() {
        this.salaryRepo = new SalaryRepository()
        this.componentRepo = new SalaryComponentRepository()
        this.attendanceRepo = new AttendanceRepository()
        this.overtimeRepo = new OvertimeRepository()
        this.leaveBalanceRepo = new LeaveBalanceRepository()
    }

    /**
     * Calculate salary for a single user for a given month
     */
    async calculateSalary(userId: string, month: number, year: number, existingUser?: any): Promise<SalaryCalculationResult> {
        // Get user data and components
        const user = existingUser || await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                basicSalary: true,
                employeeType: true,
                departmentId: true,
                siteId: true,
                // Salary configuration directly from User model
                payPeriodDay: true,
                payDay: true,
                woIncentiveEnabled: true,
                woIncentiveRate: true,
                lateDeductionRate: true,
                absentDeductionRate: true,
                overtimeRateNormal: true,
                overtimeRateHoliday: true,
                overtimeRateNational: true,
                overtimeCalcTypeNormal: true,
                overtimeCalcTypeHoliday: true,
                overtimeCalcTypeNational: true,
                workDays: true
            }
        })

        if (!user) {
            throw new Error(`User ${userId} tidak ditemukan`)
        }

        const userComponents = await this.componentRepo.getUserComponents(userId)

        if (!user.basicSalary) {
            throw new Error(`Gaji pokok untuk ${user.name || userId} belum diset`)
        }

        // Calculate date range for the period using user's Pay Period Day
        const { startDate, endDate } = this.getPeriodDateRange(month, year, user.payPeriodDay)

        // Gather data from various modules
        const [attendanceStats, overtimeStats, woStats] = await Promise.all([
            this.getAttendanceStats(userId, startDate, endDate),
            this.getOvertimeStats(userId, startDate, endDate),
            this.getWorkOrderStats(userId, startDate, endDate)
        ])

        const earnings: SalaryCalculationResult['earnings'] = []
        const deductions: SalaryCalculationResult['deductions'] = []

        // 1. Basic Salary - always included
        earnings.push({
            name: 'Gaji Pokok',
            amount: user.basicSalary
        })

        // 2. User-assigned components (tunjangan tetap)
        for (const uc of userComponents) {
            let amount = uc.amount
            let rate: number | undefined = undefined

            if (uc.component.rateType === 'PERCENTAGE') {
                amount = Math.round((user.basicSalary * uc.amount) / 100)
                rate = uc.amount // Save the percentage (e.g., 5 or 10) as rate
            }

            if (uc.component.type === 'EARNING') {
                earnings.push({
                    name: uc.component.name,
                    amount: Math.round(amount),
                    rate: rate,
                    notes: uc.notes || undefined
                })
            } else {
                deductions.push({
                    name: uc.component.name,
                    amount: Math.round(amount),
                    rate: rate,
                    notes: uc.notes || undefined
                })
            }
        }

        // 3. Overtime pay (use user rates)
        if (overtimeStats.totalMinutes > 0) {
            // Determine effective overtime rates
            const effectiveOtRateType = user.overtimeCalcTypeNormal
            const effectiveOtRateNormal = user.overtimeRateNormal || 0
            const effectiveOtRateHoliday = user.overtimeRateHoliday || 0
            const effectiveOtRateNational = user.overtimeRateNational || 0

            const overtimePay = this.calculateOvertimePay(
                overtimeStats,
                effectiveOtRateType,
                effectiveOtRateNormal,
                effectiveOtRateHoliday,
                effectiveOtRateNational,
                user.basicSalary,
                attendanceStats.workDays
            )

            if (overtimePay.amount > 0) {
                earnings.push({
                    name: 'Lembur',
                    amount: Math.round(overtimePay.amount),
                    quantity: Number(overtimePay.hours.toFixed(1)),
                    rate: Math.round(overtimePay.rate),
                    notes: `Total ${overtimePay.hours.toFixed(1)} jam`
                })
            }
        }

        // 4. Work Order Incentive
        if (user.woIncentiveEnabled && woStats.completed > 0) {
            const effectiveWoRate = user.woIncentiveRate || 0
            const woIncentive = Math.round(woStats.completed * effectiveWoRate)
            earnings.push({
                name: 'Insentif WO',
                amount: woIncentive,
                quantity: woStats.completed,
                rate: effectiveWoRate,
                notes: `${woStats.completed} WO selesai`
            })
        }

        // 5. Late deduction
        if (attendanceStats.late > 0) {
            const effectiveLateRate = user.lateDeductionRate || 0
            const lateDeduction = Math.round(attendanceStats.late * effectiveLateRate)
            deductions.push({
                name: 'Potongan Telat',
                amount: lateDeduction,
                quantity: attendanceStats.late,
                rate: effectiveLateRate,
                notes: `${attendanceStats.late} hari telat`
            })
        }

        // 6. Absent (Alpha) deduction
        if (attendanceStats.absent > 0) {
            const effectiveAbsentRate = user.absentDeductionRate || 0
            const absentDeduction = Math.round(attendanceStats.absent * effectiveAbsentRate)
            deductions.push({
                name: 'Potongan Alpha',
                amount: absentDeduction,
                quantity: attendanceStats.absent,
                rate: effectiveAbsentRate,
                notes: `${attendanceStats.absent} hari alpha`
            })
        }

        // 7. Info only: Sick & Permit (Transparent reporting)
        if (attendanceStats.sick > 0) {
            earnings.push({
                name: 'Sakit',
                amount: 0,
                quantity: attendanceStats.sick,
                notes: `${attendanceStats.sick} hari (Informasi)`
            })
        }
        if (attendanceStats.permit > 0) {
            earnings.push({
                name: 'Izin',
                amount: 0,
                quantity: attendanceStats.permit,
                notes: `${attendanceStats.permit} hari (Informasi)`
            })
        }

        // Calculate totals
        const totalEarnings = earnings.reduce((sum, e) => sum + e.amount, 0)
        const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0)
        const netSalary = totalEarnings - totalDeductions

        return {
            userId,
            month,
            year,
            basicSalary: user.basicSalary,
            earnings,
            deductions,
            totalEarnings,
            totalDeductions,
            netSalary
        }
    }

    /**
     * Calculate and save salary for a user
     */
    async calculateAndSave(userId: string, month: number, year: number, existingUser?: any): Promise<string> {
        const result = await this.calculateSalary(userId, month, year, existingUser)

        // Upsert salary record
        const salary = await this.salaryRepo.upsert(userId, month, year, {
            basicSalary: result.basicSalary,
            totalEarnings: result.totalEarnings,
            totalDeductions: result.totalDeductions,
            netSalary: result.netSalary,
            status: 'CALCULATED',
            calculatedAt: new Date()
        })

        // Clear existing details and add new ones
        await this.salaryRepo.clearDetails(salary.id)

        // Add earnings
        for (const earning of result.earnings) {
            await this.salaryRepo.addDetail(salary.id, {
                name: earning.name,
                type: 'EARNING',
                amount: earning.amount,
                quantity: earning.quantity,
                rate: earning.rate,
                notes: earning.notes
            })
        }

        // Add deductions
        for (const deduction of result.deductions) {
            await this.salaryRepo.addDetail(salary.id, {
                name: deduction.name,
                type: 'DEDUCTION',
                amount: deduction.amount,
                quantity: deduction.quantity,
                rate: deduction.rate,
                notes: deduction.notes
            })
        }

        return salary.id
    }

    /**
     * Bulk calculate for all active users
     */
    async calculateBulk(month: number, year: number, filters?: {
        departmentId?: string
        siteId?: string
        employeeType?: EmployeeType
    }): Promise<{ success: number; failed: Array<{ userId: string; error: string }> }> {
        // Get all active users with basic salary set
        const where: Prisma.UserWhereInput = {
            isActive: true,
            basicSalary: { not: null }
        }

        if (filters?.departmentId) where.departmentId = filters.departmentId
        if (filters?.siteId) where.siteId = filters.siteId
        if (filters?.employeeType) where.employeeType = filters.employeeType

        const users = await prisma.user.findMany({
            where,
            select: {
                id: true,
                name: true,
                basicSalary: true,
                employeeType: true,
                departmentId: true,
                siteId: true,
                payPeriodDay: true,
                payDay: true,
                woIncentiveEnabled: true,
                woIncentiveRate: true,
                lateDeductionRate: true,
                absentDeductionRate: true,
                overtimeRateNormal: true,
                overtimeRateHoliday: true,
                overtimeRateNational: true,
                overtimeCalcTypeNormal: true,
                overtimeCalcTypeHoliday: true,
                overtimeCalcTypeNational: true,
                workDays: true
            }
        })

        let success = 0
        const failed: Array<{ userId: string; error: string }> = []

        for (const user of users) {
            try {
                await this.calculateAndSave(user.id, month, year, user)
                success++
            } catch (error) {
                failed.push({
                    userId: user.id,
                    error: error instanceof Error ? error.message : 'Unknown error'
                })
            }
        }

        return { success, failed }
    }

    /**
     * Get period date range based on cutoff day
     */
    private getPeriodDateRange(month: number, year: number, payPeriodDay: number): { startDate: Date; endDate: Date } {
        // Example: payPeriodDay = 25
        // For January 2026 salary, we calculate from Dec 26, 2025 to Jan 25, 2026
        let startMonth = month - 1
        let startYear = year
        if (startMonth === 0) {
            startMonth = 12
            startYear = year - 1
        }

        const startDate = new Date(startYear, startMonth - 1, payPeriodDay + 1)
        const endDate = new Date(year, month - 1, payPeriodDay, 23, 59, 59)

        return { startDate, endDate }
    }

    /**
     * Get attendance statistics for the period
     */
    private async getAttendanceStats(userId: string, startDate: Date, endDate: Date): Promise<AttendanceStats> {
        const attendances = await prisma.attendance.findMany({
            where: {
                userId,
                checkIn: { gte: startDate, lte: endDate }
            },
            select: { status: true }
        })

        let present = 0
        let late = 0
        let absent = 0
        let sick = 0
        let permit = 0

        for (const a of attendances) {
            if (a.status === 'ON_TIME') present++
            else if (a.status === 'LATE') { present++; late++ }
            else if (a.status === 'ALPHA' || a.status === 'ABSENT') absent++
            else if (a.status === 'SICK') sick++
            else if (a.status === 'PERMIT') permit++
        }

        // Calculate dynamic work days based on user's schedule
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { workDays: true }
        })
        
        const workDays = this.calculateWorkDays(startDate, endDate, user?.workDays || 'Senin,Selasa,Rabu,Kamis,Jumat,Sabtu')

        return { present, late, absent, sick, permit, workDays }
    }

    /**
     * Helper to calculate actual working days in a period
     */
    private calculateWorkDays(startDate: Date, endDate: Date, workDaysStr: string): number {
        const dayMap: Record<string, number> = {
            'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6,
            'Minggu': 0, 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6
        }

        const activeDays = workDaysStr.split(',').map(d => {
            const trimmed = d.trim()
            const parsed = parseInt(trimmed)
            return isNaN(parsed) ? dayMap[trimmed] : parsed
        }).filter(d => d !== undefined)

        let count = 0
        const cur = new Date(startDate)
        while (cur <= endDate) {
            if (activeDays.includes(cur.getDay())) {
                count++
            }
            cur.setDate(cur.getDate() + 1)
        }
        return count || 22 // Fallback to 22 if calculation fails
    }

    /**
     * Get overtime statistics for the period
     */
    private async getOvertimeStats(userId: string, startDate: Date, endDate: Date): Promise<OvertimeStats> {
        const overtimes = await prisma.overtime.findMany({
            where: {
                userId,
                status: { in: ['APPROVED', 'COMPLETED'] },
                // Filter by startTime (actual work date), fallback to createdAt
                OR: [
                    { startTime: { gte: startDate, lte: endDate } },
                    {
                        AND: [
                            { startTime: null },
                            { createdAt: { gte: startDate, lte: endDate } }
                        ]
                    }
                ]
            },
            select: {
                duration: true,
                isHolidayOvertime: true,
                isNationalHoliday: true
            }
        })

        let totalMinutes = 0
        let normalMinutes = 0
        let holidayMinutes = 0
        let nationalHolidayMinutes = 0

        let normalCount = 0
        let holidayCount = 0
        let nationalCount = 0

        for (const ot of overtimes) {
            const duration = ot.duration || 0
            totalMinutes += duration

            if (ot.isNationalHoliday) {
                nationalHolidayMinutes += duration
                nationalCount++
            } else if (ot.isHolidayOvertime) {
                holidayMinutes += duration
                holidayCount++
            } else {
                normalMinutes += duration
                normalCount++
            }
        }

        return { 
            totalMinutes, 
            normalMinutes, 
            holidayMinutes, 
            nationalHolidayMinutes,
            normalCount,
            holidayCount,
            nationalCount,
            totalCount: overtimes.length
        }
    }

    /**
     * Get work order statistics for the period (for incentive)
     * Counts WO where user is main technician or helper
     * Uses verifiedAt/closedAt for accurate period filtering
     */
    private async getWorkOrderStats(userId: string, startDate: Date, endDate: Date): Promise<{ completed: number }> {
        // Find WO where this user is assigned (main or helper) and status is final (VERIFIED/CLOSED)
        const count = await prisma.workOrders.count({
            where: {
                AND: [
                    {
                        OR: [
                            { assignedToId: userId },
                            { assignments: { some: { userId: userId, status: { not: 'REJECTED' } } } }
                        ]
                    },
                    {
                        OR: [
                            { verifiedAt: { gte: startDate, lte: endDate } },
                            {
                                AND: [
                                    { verifiedAt: null },
                                    { closedAt: { gte: startDate, lte: endDate } }
                                ]
                            }
                        ]
                    }
                ],
                status: { in: ['VERIFIED', 'CLOSED'] }
            }
        })

        return { completed: count }
    }

    /**
     * Calculate overtime pay based on config rate type
     */
    private calculateOvertimePay(
        stats: OvertimeStats,
        rateType: RateType,
        rateNormal: number,
        rateHoliday: number,
        rateNational: number,
        basicSalary: number,
        workDays: number
    ): { amount: number; hours: number; rate: number } {
        const totalHours = stats.totalMinutes / 60

        if (rateType === 'FIXED') {
            // Fixed rate per overtime record (event-based)
            const amount = 
                (stats.normalCount * rateNormal) +
                (stats.holidayCount * rateHoliday) +
                (stats.nationalCount * rateNational)
            
            return {
                amount,
                hours: totalHours,
                rate: rateNormal // Representative rate
            }
        } else if (rateType === 'PERCENTAGE') {
            // Percentage of daily salary per hour
            const dailySalary = basicSalary / workDays
            const hourlyRate = (dailySalary * rateNormal) / 100 // rateNormal is percentage
            
            const normalHours = stats.normalMinutes / 60
            const holidayHours = stats.holidayMinutes / 60
            const nationalHours = stats.nationalHolidayMinutes / 60

            // Multipliers for holiday/national
            const holidayMultiplier = rateHoliday > 0 ? rateHoliday / 100 : 2 // Default 2x if not set
            const nationalMultiplier = rateNational > 0 ? rateNational / 100 : 3 // Default 3x if not set

            const amount = 
                (normalHours * hourlyRate) +
                (holidayHours * hourlyRate * holidayMultiplier) +
                (nationalHours * hourlyRate * nationalMultiplier)

            return { amount, hours: totalHours, rate: hourlyRate }
        } else if (rateType === 'DAILY_SALARY') {
            // 1x daily salary per overtime shift (8h proportional)
            const dailySalary = basicSalary / workDays
            
            const normalShifts = (stats.normalMinutes / 60) / 8
            const holidayShifts = (stats.holidayMinutes / 60) / 8
            const nationalShifts = (stats.nationalHolidayMinutes / 60) / 8

            // Optional multipliers for different days
            const holidayMult = rateHoliday > 0 ? rateHoliday / 100 : 1
            const nationalMult = rateNational > 0 ? rateNational / 100 : 1

            const amount = 
                (normalShifts * dailySalary) +
                (holidayShifts * dailySalary * holidayMult) +
                (nationalShifts * dailySalary * nationalMult)

            return {
                amount,
                hours: totalHours,
                rate: dailySalary
            }
        } else {
            // PER_HOUR (standard)
            const normalHours = stats.normalMinutes / 60
            const holidayHours = stats.holidayMinutes / 60
            const nationalHours = stats.nationalHolidayMinutes / 60

            const amount = 
                (normalHours * rateNormal) +
                (holidayHours * rateHoliday) +
                (nationalHours * rateNational)

            return { amount, hours: totalHours, rate: rateNormal }
        }
    }
}
