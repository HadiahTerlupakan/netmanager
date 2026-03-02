import { prisma } from '@/lib/prisma'
import { SalaryRepository } from '../repositories/SalaryRepository'
import { SalaryComponentRepository } from '../repositories/SalaryComponentRepository'
import { AttendanceRepository } from '../../attendance/repositories/AttendanceRepository'
import { OvertimeRepository } from '../../overtime/repositories/OvertimeRepository'
import { LeaveBalanceRepository } from '../../attendance/repositories/LeaveBalanceRepository'
import {
    RateType,
    Prisma,
    EmployeeType,
    PtkpStatus
} from '@prisma/client'

interface SalaryCalculationResult {
    userId: string
    month: number
    year: number
    basicSalary: number
    earnings: Array<{ name: string; amount: number; quantity?: number; rate?: number; notes?: string }>
    deductions: Array<{ name: string; amount: number; quantity?: number; rate?: number; notes?: string; loanId?: string }>
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

export type UserCalculationData = {
    id: string
    name: string | null
    basicSalary: number | null
    employeeType: EmployeeType
    departmentId: string | null
    siteId: string | null
    payPeriodDay: number | null
    payDay: number | null
    woIncentiveEnabled: boolean
    woIncentiveRate: number | null
    lateDeductionRate: number | null
    absentDeductionRate: number | null
    overtimeRateNormal: number | null
    overtimeRateHoliday: number | null
    overtimeRateNational: number | null
    overtimeCalcTypeNormal: RateType | null
    overtimeCalcTypeHoliday: RateType | null
    overtimeCalcTypeNational: RateType | null
    workDays: string | null
    joinDate: Date | null
    ptkpStatus: PtkpStatus | null
    bpjsKesehatan: boolean
    bpjsKetenagakerjaan: boolean
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
    async calculateSalary(userId: string, month: number, year: number, existingUser?: UserCalculationData): Promise<SalaryCalculationResult> {
        // Get user data and components
        const user = (existingUser || await prisma.user.findUnique({
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
                workDays: true,
                joinDate: true,
                ptkpStatus: true,
                bpjsKesehatan: true,
                bpjsKetenagakerjaan: true
            }
        })) as UserCalculationData | null

        if (!user) {
            throw new Error(`User ${userId} tidak ditemukan`)
        }

        const userComponents = await this.componentRepo.getUserComponents(userId)

        if (!user.basicSalary) {
            throw new Error(`Gaji pokok untuk ${user.name || userId} belum diset`)
        }
        const basicSalary = user.basicSalary as number

        // Calculate date range for the period using user's Pay Period Day
        const { startDate, endDate } = this.getPeriodDateRange(month, year, user.payPeriodDay ?? 25)

        // Gather data from various modules
        const [attendanceStats, overtimeStats, woStats] = await Promise.all([
            this.getAttendanceStats(userId, startDate, endDate),
            this.getOvertimeStats(userId, startDate, endDate),
            this.getWorkOrderStats(userId, startDate, endDate)
        ])

        const earnings: SalaryCalculationResult['earnings'] = []
        const deductions: SalaryCalculationResult['deductions'] = []

        // Prorate Calculation
        let effectiveBasicSalary = basicSalary
        let isProrated = false
        if (user.joinDate && user.joinDate > startDate && user.joinDate <= endDate) {
            // User joined in the middle of current period
            const workDaysSinceJoin = this.calculateWorkDays(user.joinDate, endDate, user.workDays || 'Senin,Selasa,Rabu,Kamis,Jumat,Sabtu')
            effectiveBasicSalary = Math.round((basicSalary / attendanceStats.workDays) * workDaysSinceJoin)
            isProrated = true
        } else if (user.joinDate && user.joinDate > endDate) {
            effectiveBasicSalary = 0
            isProrated = true
        }

        // 1. Basic Salary - always included
        earnings.push({
            name: 'Gaji Pokok',
            amount: effectiveBasicSalary,
            notes: isProrated && effectiveBasicSalary > 0 ? 'Prorate (karyawan baru)' : undefined
        })

        // 2. User-assigned components (tunjangan tetap)
        for (const uc of userComponents) {
            let amount = uc.amount
            let rate: number | undefined = undefined

            if (uc.component.rateType === 'PERCENTAGE') {
                amount = Math.round((effectiveBasicSalary * uc.amount) / 100)
                rate = uc.amount // Save the percentage (e.g., 5 or 10) as rate
            } else if (isProrated && effectiveBasicSalary > 0 && uc.component.type === 'EARNING') {
                // Prorate fixed allowance
                const workDaysSinceJoin = this.calculateWorkDays(user.joinDate!, endDate, user.workDays || 'Senin,Selasa,Rabu,Kamis,Jumat,Sabtu')
                amount = Math.round((uc.amount / attendanceStats.workDays) * workDaysSinceJoin)
            } else if (isProrated && effectiveBasicSalary === 0) {
                amount = 0
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
                basicSalary,
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

        // 6. Absent (Alpha / Unpaid Leave) deduction
        if (attendanceStats.absent > 0 || attendanceStats.sick > 0 || attendanceStats.permit > 0) {
            // Unpaid calculation: if limits exist in HR rules, they would be checked here.
            // Currently applying user requested formula for Alpha: (Basic Salary / Work Days) * Absent Days
            const deductionPerDay = Math.round(effectiveBasicSalary / attendanceStats.workDays)
            let absentDeduction = deductionPerDay * attendanceStats.absent

            // Allow override if custom rate is higher (penalty)
            if (user.absentDeductionRate && user.absentDeductionRate > deductionPerDay) {
                absentDeduction = user.absentDeductionRate * attendanceStats.absent
            }

            if (absentDeduction > 0) {
                deductions.push({
                    name: 'Potongan Alpha / Unpaid',
                    amount: absentDeduction,
                    quantity: attendanceStats.absent,
                    rate: Math.max(deductionPerDay, user.absentDeductionRate || 0),
                    notes: `${attendanceStats.absent} hari absen/unpaid`
                })
            }
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

        // 8. BPJS Deductions
        const bpjsBaseSalary = earnings.filter(e => e.name === 'Gaji Pokok' || e.rate !== undefined).reduce((sum, e) => sum + e.amount, 0)

        if (user.bpjsKesehatan) {
            // BPJS Kesehatan 1% of Gaji Pokok + Tunjangan Tetap (Cap 12,000,000)
            const baseKes = Math.min(12000000, bpjsBaseSalary)
            const bpjsKesAmount = Math.round(baseKes * 0.01)
            deductions.push({
                name: 'BPJS Kesehatan (1%)',
                amount: bpjsKesAmount,
                notes: `Batas max Rp12jt`
            })
        }

        if (user.bpjsKetenagakerjaan) {
            // BPJS JHT 2% + JP 1% (Cap 10,042,300)
            const bpjsJhtAmount = Math.round(bpjsBaseSalary * 0.02)
            const baseJp = Math.min(10042300, bpjsBaseSalary)
            const bpjsJpAmount = Math.round(baseJp * 0.01)

            deductions.push({
                name: 'BPJS JHT (2%)',
                amount: bpjsJhtAmount,
            })
            deductions.push({
                name: 'BPJS Pensiun (1%)',
                amount: bpjsJpAmount,
                notes: `Batas max Rp10jt`
            })
        }

        // 9. Employee Loan Deductions
        const activeLoans = await prisma.employeeLoan.findMany({
            where: { userId, status: 'ACTIVE' }
        })

        for (const loan of activeLoans) {
            if (loan.remainingAmount > 0) {
                const deductionAmount = Math.min(loan.installment, loan.remainingAmount)

                deductions.push({
                    name: 'Cicilan Pinjaman',
                    amount: deductionAmount,
                    loanId: loan.id,
                    notes: `Sisa sebelum dipotong: Rp${loan.remainingAmount.toLocaleString()}`
                })
            }
        }

        // 10. Tax (PPh 21 TER)
        const grossIncome = earnings.reduce((sum, e) => sum + e.amount, 0)
        if (user.ptkpStatus && grossIncome > 0) {
            const pph21Amount = this.calculatePph21Ter(grossIncome, user.ptkpStatus)
            if (pph21Amount > 0) {
                deductions.push({
                    name: 'Pajak PPh 21 (TER)',
                    amount: pph21Amount,
                    notes: `Status PTKP: ${user.ptkpStatus.replace('_', '/')}`
                })
            }
        }

        // Calculate totals
        const totalEarnings = earnings.reduce((sum, e) => sum + e.amount, 0)
        const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0)
        const netSalary = totalEarnings - totalDeductions

        return {
            userId,
            month,
            year,
            basicSalary: basicSalary,
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
    async calculateAndSave(userId: string, month: number, year: number, existingUser?: UserCalculationData): Promise<string> {
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

        // Revert previous loan payments if any before clearing details
        const existingDetailsWithLoans = await prisma.salaryDetail.findMany({
            where: { salaryId: salary.id, loanPaymentId: { not: null } },
            include: { loanPayment: true }
        })

        for (const detail of existingDetailsWithLoans) {
            if (detail.loanPayment) {
                await prisma.$transaction(async (tx) => {
                    const loan = await tx.employeeLoan.findUnique({ where: { id: detail.loanPayment!.loanId } })
                    if (loan) {
                        const newRemaining = loan.remainingAmount + detail.loanPayment!.amount
                        await tx.employeeLoan.update({
                            where: { id: loan.id },
                            data: { remainingAmount: newRemaining, status: 'ACTIVE' }
                        })
                    }
                    await tx.loanPayment.delete({ where: { id: detail.loanPaymentId! } })
                })
            }
        }

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
            let loanPaymentId: string | undefined = undefined

            if (deduction.loanId) {
                loanPaymentId = await prisma.$transaction(async (tx) => {
                    const loan = await tx.employeeLoan.findUnique({ where: { id: deduction.loanId! } })
                    if (!loan) return undefined

                    const newRemaining = Math.max(0, loan.remainingAmount - deduction.amount)
                    const newStatus = newRemaining <= 0 ? 'PAID_OFF' : 'ACTIVE'

                    await tx.employeeLoan.update({
                        where: { id: loan.id },
                        data: { remainingAmount: newRemaining, status: newStatus }
                    })

                    const payment = await tx.loanPayment.create({
                        data: {
                            loanId: loan.id,
                            amount: deduction.amount,
                            notes: `Potongan gaji otomatis bulan ${month}/${year}`
                        }
                    })
                    return payment.id
                })
            }

            // Using prisma directly to include loanPaymentId
            await prisma.salaryDetail.create({
                data: {
                    salaryId: salary.id,
                    name: deduction.name,
                    type: 'DEDUCTION',
                    amount: deduction.amount,
                    quantity: deduction.quantity,
                    rate: deduction.rate,
                    notes: deduction.notes,
                    loanPaymentId: loanPaymentId
                }
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
                workDays: true,
                joinDate: true,
                ptkpStatus: true,
                bpjsKesehatan: true,
                bpjsKetenagakerjaan: true
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
                    error: error instanceof Error ? error.message : 'Terjadi kesalahan'
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
        }).filter((d): d is number => d !== undefined)

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

    /**
     * Helper to calculate PPh 21 using Tarif Efektif Rata-rata (TER)
     * Note: Simplified representation of TER 2024 category bounds.
     */
    private calculatePph21Ter(grossIncome: number, ptkpStatus: PtkpStatus): number {
        let rate = 0;

        // Kategori A
        if (['TK_0', 'TK_1', 'K_0'].includes(ptkpStatus)) {
            if (grossIncome <= 5400000) rate = 0;
            else if (grossIncome <= 5650000) rate = 0.0025;
            else if (grossIncome <= 5950000) rate = 0.005;
            else if (grossIncome <= 6300000) rate = 0.0075;
            else if (grossIncome <= 6750000) rate = 0.01;
            else if (grossIncome <= 7500000) rate = 0.0125;
            else if (grossIncome <= 8550000) rate = 0.015;
            else if (grossIncome <= 9650000) rate = 0.0175;
            else if (grossIncome <= 10050000) rate = 0.02;
            else if (grossIncome <= 10350000) rate = 0.0225;
            else if (grossIncome <= 10700000) rate = 0.025;
            else rate = 0.03;
        }
        // Kategori B
        else if (['TK_2', 'TK_3', 'K_1', 'K_2'].includes(ptkpStatus)) {
            if (grossIncome <= 6200000) rate = 0;
            else if (grossIncome <= 6500000) rate = 0.0025;
            else if (grossIncome <= 6850000) rate = 0.005;
            else if (grossIncome <= 7300000) rate = 0.0075;
            else if (grossIncome <= 9200000) rate = 0.015;
            else if (grossIncome <= 10750000) rate = 0.02;
            else rate = 0.03;
        }
        // Kategori C
        else if (['K_3'].includes(ptkpStatus)) {
            if (grossIncome <= 6600000) rate = 0;
            else if (grossIncome <= 6950000) rate = 0.0025;
            else if (grossIncome <= 7350000) rate = 0.005;
            else if (grossIncome <= 7800000) rate = 0.0075;
            else if (grossIncome <= 8850000) rate = 0.01;
            else rate = 0.03;
        }

        return Math.floor(grossIncome * rate);
    }
}
