import { SalaryRepository } from '../repositories/SalaryRepository'
import { SalaryComponentRepository } from '../repositories/SalaryComponentRepository'
import { AttendanceRepository } from '../../attendance/repositories/AttendanceRepository'
import { OvertimeRepository } from '../../overtime/repositories/OvertimeRepository'
import { LeaveBalanceRepository } from '../../attendance/repositories/LeaveBalanceRepository'
import {
    UserRepository,
    EmployeeLoanRepository,
    AttendanceRepositoryForSalary,
    OvertimeRepositoryForSalary,
    WorkOrderRepositoryForSalary,
    SalaryDetailRepository,
    runTransaction
} from '../repositories/SalaryCalculationRepositories'
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
    absent: number
    sick: number
    permit: number
    workDays: number
}

interface OvertimeStats {
    totalMinutes: number
    normalMinutes: number
    holidayMinutes: number
    nationalHolidayMinutes: number
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
    private userRepository: UserRepository
    private employeeLoanRepository: EmployeeLoanRepository
    private attendanceRepoForSalary: AttendanceRepositoryForSalary
    private overtimeRepoForSalary: OvertimeRepositoryForSalary
    private workOrderRepoForSalary: WorkOrderRepositoryForSalary
    private salaryDetailRepository: SalaryDetailRepository

    constructor() {
        this.salaryRepo = new SalaryRepository()
        this.componentRepo = new SalaryComponentRepository()
        this.attendanceRepo = new AttendanceRepository()
        this.overtimeRepo = new OvertimeRepository()
        this.leaveBalanceRepo = new LeaveBalanceRepository()
        this.userRepository = new UserRepository()
        this.employeeLoanRepository = new EmployeeLoanRepository()
        this.attendanceRepoForSalary = new AttendanceRepositoryForSalary()
        this.overtimeRepoForSalary = new OvertimeRepositoryForSalary()
        this.workOrderRepoForSalary = new WorkOrderRepositoryForSalary()
        this.salaryDetailRepository = new SalaryDetailRepository()
    }

    async calculateSalary(userId: string, month: number, year: number, existingUser?: UserCalculationData): Promise<SalaryCalculationResult> {
        const user = (existingUser || await this.userRepository.findSalaryData(userId)) as UserCalculationData | null

        if (!user) {
            throw new Error(`User ${userId} tidak ditemukan`)
        }

        const userComponents = await this.componentRepo.getUserComponents(userId)

        if (!user.basicSalary) {
            throw new Error(`Gaji pokok untuk ${user.name || userId} belum diset`)
        }
        const basicSalary = user.basicSalary as number

        const { startDate, endDate } = this.getPeriodDateRange(month, year, user.payPeriodDay ?? 25)

        const [attendanceStats, overtimeStats, woStats] = await Promise.all([
            this.getAttendanceStats(userId, startDate, endDate),
            this.getOvertimeStats(userId, startDate, endDate),
            this.getWorkOrderStats(userId, startDate, endDate)
        ])

        const earnings: SalaryCalculationResult['earnings'] = []
        const deductions: SalaryCalculationResult['deductions'] = []

        let effectiveBasicSalary = basicSalary
        let isProrated = false
        if (user.joinDate && user.joinDate > startDate && user.joinDate <= endDate) {
            const workDaysSinceJoin = this.calculateWorkDays(user.joinDate, endDate, user.workDays || 'Senin,Selasa,Rabu,Kamis,Jumat,Sabtu')
            effectiveBasicSalary = Math.round((basicSalary / attendanceStats.workDays) * workDaysSinceJoin)
            isProrated = true
        } else if (user.joinDate && user.joinDate > endDate) {
            effectiveBasicSalary = 0
            isProrated = true
        }

        earnings.push({
            name: 'Gaji Pokok',
            amount: effectiveBasicSalary,
            notes: isProrated && effectiveBasicSalary > 0 ? 'Prorate (karyawan baru)' : undefined
        })

        for (const uc of userComponents) {
            let amount = uc.amount
            let rate: number | undefined = undefined

            if (uc.component.rateType === 'PERCENTAGE') {
                amount = Math.round((effectiveBasicSalary * uc.amount) / 100)
                rate = uc.amount
            } else if (isProrated && effectiveBasicSalary > 0 && uc.component.type === 'EARNING') {
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

        if (overtimeStats.totalMinutes > 0) {
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

        if (attendanceStats.absent > 0 || attendanceStats.sick > 0 || attendanceStats.permit > 0) {
            const deductionPerDay = Math.round(effectiveBasicSalary / attendanceStats.workDays)
            let absentDeduction = deductionPerDay * attendanceStats.absent

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

        const bpjsBaseSalary = earnings.filter(e => e.name === 'Gaji Pokok' || e.rate !== undefined).reduce((sum, e) => sum + e.amount, 0)

        if (user.bpjsKesehatan) {
            const baseKes = Math.min(12000000, bpjsBaseSalary)
            const bpjsKesAmount = Math.round(baseKes * 0.01)
            deductions.push({
                name: 'BPJS Kesehatan (1%)',
                amount: bpjsKesAmount,
                notes: `Batas max Rp12jt`
            })
        }

        if (user.bpjsKetenagakerjaan) {
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

        const activeLoans = await this.employeeLoanRepository.findActiveByUserId(userId)

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

    async calculateAndSave(userId: string, month: number, year: number, existingUser?: UserCalculationData): Promise<string> {
        const result = await this.calculateSalary(userId, month, year, existingUser)

        const salary = await this.salaryRepo.upsert(userId, month, year, {
            basicSalary: result.basicSalary,
            totalEarnings: result.totalEarnings,
            totalDeductions: result.totalDeductions,
            netSalary: result.netSalary,
            status: 'CALCULATED',
            calculatedAt: new Date()
        })

        const existingDetailsWithLoans = await this.salaryDetailRepository.findManyWithLoanPayment(salary.id)

        for (const detail of existingDetailsWithLoans) {
            if (detail.loanPayment) {
                await runTransaction(async (tx) => {
                    const loan = await this.employeeLoanRepository.findUnique(detail.loanPayment!.loanId)
                    if (loan) {
                        const newRemaining = loan.remainingAmount + detail.loanPayment!.amount
                        await this.employeeLoanRepository.updateInTransaction(tx, loan.id, {
                            remainingAmount: newRemaining,
                            status: 'ACTIVE'
                        })
                    }
                    await this.employeeLoanRepository.deleteLoanPaymentInTransaction(tx, detail.loanPaymentId!)
                })
            }
        }

        await this.salaryRepo.clearDetails(salary.id)

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

        for (const deduction of result.deductions) {
            let loanPaymentId: string | undefined = undefined

            if (deduction.loanId) {
                loanPaymentId = await runTransaction(async (tx) => {
                    const loan = await this.employeeLoanRepository.findUnique(deduction.loanId!)
                    if (!loan) return undefined

                    const newRemaining = Math.max(0, loan.remainingAmount - deduction.amount)
                    const newStatus = newRemaining <= 0 ? 'PAID_OFF' : 'ACTIVE'

                    await this.employeeLoanRepository.updateInTransaction(tx, loan.id, {
                        remainingAmount: newRemaining,
                        status: newStatus
                    })

                    const payment = await this.employeeLoanRepository.createLoanPaymentInTransaction(tx, {
                        loan: { connect: { id: loan.id } },
                        amount: deduction.amount,
                        notes: `Potongan gaji otomatis bulan ${month}/${year}`
                    })
                    return payment.id
                })
            }

            await this.salaryDetailRepository.createWithLoanPayment({
                salary: { connect: { id: salary.id } },
                name: deduction.name,
                type: 'DEDUCTION',
                amount: deduction.amount,
                quantity: deduction.quantity,
                rate: deduction.rate,
                notes: deduction.notes,
                ...(loanPaymentId && { loanPayment: { connect: { id: loanPaymentId } } })
            })
        }

        return salary.id
    }

    async calculateBulk(month: number, year: number, filters?: {
        departmentId?: string
        siteId?: string
        employeeType?: EmployeeType
    }): Promise<{ success: number; failed: Array<{ userId: string; error: string }> }> {
        const users = await this.userRepository.findActiveUsersWithBasicSalary(filters)

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

    private getPeriodDateRange(month: number, year: number, payPeriodDay: number): { startDate: Date; endDate: Date } {
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

    private async getAttendanceStats(userId: string, startDate: Date, endDate: Date): Promise<AttendanceStats> {
        const attendances = await this.attendanceRepoForSalary.findByUserAndDateRange(userId, startDate, endDate)

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

        const userWorkDays = await this.userRepository.findWorkDays(userId)

        const workDays = this.calculateWorkDays(startDate, endDate, userWorkDays?.workDays || 'Senin,Selasa,Rabu,Kamis,Jumat,Sabtu')

        return { present, late, absent, sick, permit, workDays }
    }

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
        return count || 22
    }

    private async getOvertimeStats(userId: string, startDate: Date, endDate: Date): Promise<OvertimeStats> {
        const overtimes = await this.overtimeRepoForSalary.findApprovedByUserAndDateRange(userId, startDate, endDate)

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

    private async getWorkOrderStats(userId: string, startDate: Date, endDate: Date): Promise<{ completed: number }> {
        const count = await this.workOrderRepoForSalary.countCompletedForUser(userId, startDate, endDate)

        return { completed: count }
    }

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
            const amount =
                (stats.normalCount * rateNormal) +
                (stats.holidayCount * rateHoliday) +
                (stats.nationalCount * rateNational)

            return {
                amount,
                hours: totalHours,
                rate: rateNormal
            }
        } else if (rateType === 'PERCENTAGE') {
            const dailySalary = basicSalary / workDays
            const hourlyRate = (dailySalary * rateNormal) / 100

            const normalHours = stats.normalMinutes / 60
            const holidayHours = stats.holidayMinutes / 60
            const nationalHours = stats.nationalHolidayMinutes / 60

            const holidayMultiplier = rateHoliday > 0 ? rateHoliday / 100 : 2
            const nationalMultiplier = rateNational > 0 ? rateNational / 100 : 3

            const amount =
                (normalHours * hourlyRate) +
                (holidayHours * hourlyRate * holidayMultiplier) +
                (nationalHours * hourlyRate * nationalMultiplier)

            return { amount, hours: totalHours, rate: hourlyRate }
        } else if (rateType === 'DAILY_SALARY') {
            const dailySalary = basicSalary / workDays

            const normalShifts = (stats.normalMinutes / 60) / 8
            const holidayShifts = (stats.holidayMinutes / 60) / 8
            const nationalShifts = (stats.nationalHolidayMinutes / 60) / 8

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

    private calculatePph21Ter(grossIncome: number, ptkpStatus: PtkpStatus): number {
        let rate = 0;

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
        else if (['TK_2', 'TK_3', 'K_1', 'K_2'].includes(ptkpStatus)) {
            if (grossIncome <= 6200000) rate = 0;
            else if (grossIncome <= 6500000) rate = 0.0025;
            else if (grossIncome <= 6850000) rate = 0.005;
            else if (grossIncome <= 7300000) rate = 0.0075;
            else if (grossIncome <= 9200000) rate = 0.015;
            else if (grossIncome <= 10750000) rate = 0.02;
            else rate = 0.03;
        }
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
