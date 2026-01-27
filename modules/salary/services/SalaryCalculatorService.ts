import { prisma } from '@/lib/prisma'
import { SalaryRepository } from '../repositories/SalaryRepository'
import { SalaryConfigRepository } from '../repositories/SalaryConfigRepository'
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
    workDays: number
}

interface OvertimeStats {
    totalMinutes: number
    normalMinutes: number
    holidayMinutes: number
    nationalHolidayMinutes: number
}

export class SalaryCalculatorService {
    private salaryRepo: SalaryRepository
    private configRepo: SalaryConfigRepository
    private componentRepo: SalaryComponentRepository
    private attendanceRepo: AttendanceRepository
    private overtimeRepo: OvertimeRepository
    private leaveBalanceRepo: LeaveBalanceRepository

    constructor() {
        this.salaryRepo = new SalaryRepository()
        this.configRepo = new SalaryConfigRepository()
        this.componentRepo = new SalaryComponentRepository()
        this.attendanceRepo = new AttendanceRepository()
        this.overtimeRepo = new OvertimeRepository()
        this.leaveBalanceRepo = new LeaveBalanceRepository()
    }

    /**
     * Calculate salary for a single user for a given month
     */
    async calculateSalary(userId: string, month: number, year: number): Promise<SalaryCalculationResult> {
        // Get config and user data
        const [config, user, userComponents] = await Promise.all([
            this.configRepo.getOrCreateConfig(),
            prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    name: true,
                    basicSalary: true,
                    employeeType: true,
                    departmentId: true,
                    siteId: true,
                    // User-level rate overrides
                    woIncentiveRate: true,
                    lateDeductionRate: true,
                    absentDeductionRate: true,
                    overtimeRateNormal: true,
                    overtimeRateHoliday: true,
                    overtimeRateNational: true,
                    overtimeCalcTypeNormal: true,
                    overtimeCalcTypeHoliday: true,
                    overtimeCalcTypeNational: true
                }
            }),
            this.componentRepo.getUserComponents(userId)
        ])

        if (!user) {
            throw new Error(`User ${userId} tidak ditemukan`)
        }

        if (!user.basicSalary) {
            throw new Error(`Gaji pokok untuk ${user.name || userId} belum diset`)
        }

        // Calculate date range for the period
        const { startDate, endDate } = this.getPeriodDateRange(month, year, config.payPeriodDay)

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
        // 2. User-assigned components (tunjangan tetap)
        for (const uc of userComponents) {
            let amount = uc.amount
            let rate: number | undefined = undefined

            if (uc.component.rateType === 'PERCENTAGE') {
                amount = (user.basicSalary * uc.amount) / 100
                rate = uc.amount // Save the percentage (e.g., 5 or 10) as rate
            }

            if (uc.component.type === 'EARNING') {
                earnings.push({
                    name: uc.component.name,
                    amount: amount,
                    rate: rate,
                    notes: uc.notes || undefined
                })
            } else {
                deductions.push({
                    name: uc.component.name,
                    amount: amount,
                    rate: rate,
                    notes: uc.notes || undefined
                })
            }
        }

        // 3. Overtime pay (use user rates if set, otherwise global config)
        if (overtimeStats.totalMinutes > 0) {
            // Determine effective overtime rates
            // Note: user can have different CalcType per overtime type
            // For simplicity, we use user's normal calc type as the overall type, or fallback to config
            const effectiveOtRateType = user.overtimeCalcTypeNormal || config.overtimeRateType
            const effectiveOtRateNormal = (user.overtimeRateNormal != null && user.overtimeRateNormal > 0) ? user.overtimeRateNormal : config.overtimeRateNormal
            const effectiveOtRateHoliday = (user.overtimeRateHoliday != null && user.overtimeRateHoliday > 0) ? user.overtimeRateHoliday : config.overtimeRateHoliday
            const effectiveOtRateNational = (user.overtimeRateNational != null && user.overtimeRateNational > 0) ? user.overtimeRateNational : config.overtimeRateNational

            const overtimePay = this.calculateOvertimePay(
                overtimeStats,
                effectiveOtRateType as RateType,
                effectiveOtRateNormal,
                effectiveOtRateHoliday,
                effectiveOtRateNational,
                user.basicSalary,
                attendanceStats.workDays
            )

            if (overtimePay.amount > 0) {
                earnings.push({
                    name: 'Lembur',
                    amount: overtimePay.amount,
                    quantity: overtimePay.hours,
                    rate: overtimePay.rate,
                    notes: `Total ${overtimePay.hours.toFixed(1)} jam`
                })
            }
        }

        // 4. Work Order Incentive (use user rate if set, otherwise global config)
        if (config.woIncentiveEnabled && woStats.completed > 0) {
            const effectiveWoRate = (user.woIncentiveRate != null && user.woIncentiveRate > 0) ? user.woIncentiveRate : config.woIncentiveRate
            const woIncentive = woStats.completed * effectiveWoRate
            earnings.push({
                name: 'Insentif WO',
                amount: woIncentive,
                quantity: woStats.completed,
                rate: effectiveWoRate,
                notes: `${woStats.completed} WO selesai`
            })
        }

        // 5. Late deduction (use user rate if set, otherwise global config)
        if (attendanceStats.late > 0) {
            const effectiveLateRate = (user.lateDeductionRate != null && user.lateDeductionRate > 0) ? user.lateDeductionRate : config.lateDeductionRate
            const lateDeduction = attendanceStats.late * effectiveLateRate
            deductions.push({
                name: 'Potongan Telat',
                amount: lateDeduction,
                quantity: attendanceStats.late,
                rate: effectiveLateRate,
                notes: `${attendanceStats.late} hari telat`
            })
        }

        // 6. Absent (Alpha) deduction (use user rate if set, otherwise global config)
        if (attendanceStats.absent > 0) {
            const effectiveAbsentRate = (user.absentDeductionRate != null && user.absentDeductionRate > 0) ? user.absentDeductionRate : config.absentDeductionRate
            const absentDeduction = attendanceStats.absent * effectiveAbsentRate
            deductions.push({
                name: 'Potongan Alpha',
                amount: absentDeduction,
                quantity: attendanceStats.absent,
                rate: effectiveAbsentRate,
                notes: `${attendanceStats.absent} hari alpha`
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
    async calculateAndSave(userId: string, month: number, year: number): Promise<string> {
        const result = await this.calculateSalary(userId, month, year)

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
            select: { id: true, name: true }
        })

        let success = 0
        const failed: Array<{ userId: string; error: string }> = []

        for (const user of users) {
            try {
                await this.calculateAndSave(user.id, month, year)
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

        for (const a of attendances) {
            if (a.status === 'ON_TIME') present++
            else if (a.status === 'LATE') { present++; late++ }
            else if (a.status === 'ALPHA' || a.status === 'ABSENT') absent++
        }

        // Estimate work days (simple: ~22 days per month)
        const workDays = 22

        return { present, late, absent, workDays }
    }

    /**
     * Get overtime statistics for the period
     */
    private async getOvertimeStats(userId: string, startDate: Date, endDate: Date): Promise<OvertimeStats> {
        const overtimes = await prisma.overtime.findMany({
            where: {
                userId,
                status: { in: ['APPROVED', 'COMPLETED'] },
                createdAt: { gte: startDate, lte: endDate }
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

        for (const ot of overtimes) {
            const duration = ot.duration || 0
            totalMinutes += duration

            if (ot.isNationalHoliday) {
                nationalHolidayMinutes += duration
            } else if (ot.isHolidayOvertime) {
                holidayMinutes += duration
            } else {
                normalMinutes += duration
            }
        }

        return { totalMinutes, normalMinutes, holidayMinutes, nationalHolidayMinutes }
    }

    /**
     * Get work order statistics for the period (for incentive)
     * Only counts WO that have been VERIFIED by admin
     */
    private async getWorkOrderStats(userId: string, startDate: Date, endDate: Date): Promise<{ completed: number }> {
        // Find WO where this user is assigned and the WO has been VERIFIED by admin
        const verifiedCount = await prisma.workOrders.count({
            where: {
                assignedToId: userId,
                status: 'VERIFIED',
                updatedAt: { gte: startDate, lte: endDate }
            }
        })

        return { completed: verifiedCount }
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
            // Fixed rate per overtime event (count as 1 per day)
            const overtimeDays = Math.ceil(totalHours / 3) // Assume 3 hours = 1 overtime event
            return {
                amount: overtimeDays * rateNormal,
                hours: totalHours,
                rate: rateNormal
            }
        } else if (rateType === 'PERCENTAGE') {
            // Percentage of daily salary per hour
            const dailySalary = basicSalary / workDays
            const hourlyRate = (dailySalary * rateNormal) / 100 // rateNormal is percentage
            
            const normalHours = stats.normalMinutes / 60
            const holidayHours = stats.holidayMinutes / 60
            const nationalHours = stats.nationalHolidayMinutes / 60

            const amount = 
                (normalHours * hourlyRate) +
                (holidayHours * hourlyRate * rateHoliday / 100) +
                (nationalHours * hourlyRate * rateNational / 100)

            return { amount, hours: totalHours, rate: hourlyRate }
        } else if (rateType === 'DAILY_SALARY') {
            // 1x daily salary per overtime day
            const dailySalary = basicSalary / workDays
            const overtimeDays = Math.ceil(totalHours / 8) // 8 hours = 1 day
            return {
                amount: overtimeDays * dailySalary,
                hours: totalHours,
                rate: dailySalary
            }
        } else {
            // PER_HOUR (default)
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
