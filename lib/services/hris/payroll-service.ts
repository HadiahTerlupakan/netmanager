import { prisma } from '@/lib/prisma'
import { AttendanceRepository } from '@/lib/repositories/AttendanceRepository'
import { EmployeeRepository } from '@/lib/repositories/EmployeeRepository'

interface PayrollCalculation {
    employeeId: string
    basicSalary: bigint
    allowances: bigint
    bonuses: bigint
    grossSalary: bigint
    deductions: bigint
    tax: bigint
    insurance: bigint
    totalDeduction: bigint
    netSalary: bigint
    overtimeHours: number
    overtimePay: bigint
    daysWorked: number
    daysAbsent: number
    lateCount: number
    componentBreakdown: any
}

export class PayrollService {
    private attendanceRepo: AttendanceRepository
    private employeeRepo: EmployeeRepository

    constructor() {
        this.attendanceRepo = new AttendanceRepository()
        this.employeeRepo = new EmployeeRepository()
    }

    /**
     * Calculate payroll for a specific month and year
     */
    async calculateMonthlyPayroll(month: number, year: number): Promise<string> {
        // Create payroll header
        const periodStart = new Date(year, month - 1, 1)
        const periodEnd = new Date(year, month, 0) // Last day of month

        const payroll = await prisma.payroll.create({
            data: {
                month,
                year,
                periodStart,
                periodEnd,
                status: 'DRAFT',
                totalGross: BigInt(0),
                totalDeduction: BigInt(0),
                totalNet: BigInt(0),
                totalEmployees: 0,
            },
        })

        // Get all active employees
        const employees = await this.employeeRepo.findActiveEmployees()

        let totalGross = BigInt(0)
        let totalDeduction = BigInt(0)
        let totalNet = BigInt(0)

        // Calculate each employee's payroll
        for (const employee of employees) {
            const calculation = await this.calculateEmployeePayroll(
                employee.id,
                periodStart,
                periodEnd
            )

            // Create payroll detail
            await prisma.payrollDetail.create({
                data: {
                    payrollId: payroll.id,
                    employeeId: employee.id,
                    basicSalary: calculation.basicSalary,
                    allowances: calculation.allowances,
                    bonuses: calculation.bonuses,
                    grossSalary: calculation.grossSalary,
                    deductions: calculation.deductions,
                    tax: calculation.tax,
                    insurance: calculation.insurance,
                    totalDeduction: calculation.totalDeduction,
                    netSalary: calculation.netSalary,
                    overtimeHours: calculation.overtimeHours,
                    overtimePay: calculation.overtimePay,
                    daysWorked: calculation.daysWorked,
                    daysAbsent: calculation.daysAbsent,
                    lateCount: calculation.lateCount,
                    componentBreakdown: calculation.componentBreakdown,
                },
            })

            totalGross += calculation.grossSalary
            totalDeduction += calculation.totalDeduction
            totalNet += calculation.netSalary
        }

        // Update payroll totals
        await prisma.payroll.update({
            where: { id: payroll.id },
            data: {
                totalGross,
                totalDeduction,
                totalNet,
                totalEmployees: employees.length,
                status: 'CALCULATED',
                processedAt: new Date(),
            },
        })

        return payroll.id
    }

    /**
     * Calculate individual employee payroll
     */
    private async calculateEmployeePayroll(
        employeeId: string,
        periodStart: Date,
        periodEnd: Date
    ): Promise<PayrollCalculation> {
        // Get employee salary components
        const salaryComponents = await prisma.employeeSalary.findMany({
            where: {
                employeeId,
                effectiveDate: { lte: periodEnd },
                OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
            },
            include: {
                salaryComponent: true,
            },
        })

        // Get attendance data for the period
        const attendances = await this.attendanceRepo.findByEmployee(
            employeeId,
            periodStart,
            periodEnd
        )

        // Calculate attendance metrics
        const daysWorked = attendances.filter(
            (a) => a.status === 'PRESENT' || a.status === 'LATE'
        ).length
        const daysAbsent = attendances.filter((a) => a.status === 'ABSENT').length
        const lateCount = attendances.filter((a) => a.status === 'LATE').length

        // Get overtime data
        const overtimes = await prisma.overtime.findMany({
            where: {
                employeeId,
                date: { gte: periodStart, lte: periodEnd },
                isApproved: true,
            },
        })

        const overtimeHours = overtimes.reduce((sum, ot) => sum + ot.hours, 0)

        // Calculate salary components
        let basicSalary = BigInt(0)
        let allowances = BigInt(0)
        let bonuses = BigInt(0)
        let deductions = BigInt(0)
        let insurance = BigInt(0)

        const componentBreakdown: any = {
            earnings: [],
            deductions: [],
        }

        for (const empSalary of salaryComponents) {
            const component = empSalary.salaryComponent
            const amount = empSalary.amount

            switch (component.type) {
                case 'BASIC_SALARY':
                    basicSalary += amount
                    componentBreakdown.earnings.push({
                        name: component.name,
                        amount: amount.toString(),
                    })
                    break
                case 'ALLOWANCE':
                    allowances += amount
                    componentBreakdown.earnings.push({
                        name: component.name,
                        amount: amount.toString(),
                    })
                    break
                case 'BONUS':
                    bonuses += amount
                    componentBreakdown.earnings.push({
                        name: component.name,
                        amount: amount.toString(),
                    })
                    break
                case 'DEDUCTION':
                    deductions += amount
                    componentBreakdown.deductions.push({
                        name: component.name,
                        amount: amount.toString(),
                    })
                    break
                case 'INSURANCE':
                    insurance += amount
                    componentBreakdown.deductions.push({
                        name: component.name,
                        amount: amount.toString(),
                    })
                    break
            }
        }

        // Calculate overtime pay (1.5x hourly rate)
        const workingDaysInMonth = 22 // Standard working days
        const workingHoursPerDay = 8
        const hourlyRate = Number(basicSalary) / (workingDaysInMonth * workingHoursPerDay)
        const overtimePay = BigInt(Math.floor(hourlyRate * overtimeHours * 1.5))

        // Calculate gross salary
        const grossSalary = basicSalary + allowances + bonuses + overtimePay

        // Calculate tax (simplified PPh 21 - 5% for demo)
        // In production, use proper tax brackets
        const taxableIncome = grossSalary - insurance
        const tax = BigInt(Math.floor(Number(taxableIncome) * 0.05))

        const totalDeduction = deductions + tax + insurance
        const netSalary = grossSalary - totalDeduction

        return {
            employeeId,
            basicSalary,
            allowances,
            bonuses,
            grossSalary,
            deductions,
            tax,
            insurance,
            totalDeduction,
            netSalary,
            overtimeHours,
            overtimePay,
            daysWorked,
            daysAbsent,
            lateCount,
            componentBreakdown,
        }
    }

    /**
     * Approve payroll (HR/Admin)
     */
    async approvePayroll(payrollId: string, approvedBy: string): Promise<void> {
        await prisma.payroll.update({
            where: { id: payrollId },
            data: {
                status: 'APPROVED',
                approvedBy,
                approvedAt: new Date(),
            },
        })
    }

    /**
     * Mark payroll as paid and create Pengeluaran entry in Finance
     */
    async markAsPaid(
        payrollId: string,
        paidBy: string,
        bankAccountId: string
    ): Promise<void> {
        const payroll = await prisma.payroll.findUnique({
            where: { id: payrollId },
            include: {
                payrollDetails: {
                    include: {
                        employee: true,
                    },
                },
            },
        })

        if (!payroll) {
            throw new Error('Payroll not found')
        }

        if (payroll.status !== 'APPROVED') {
            throw new Error('Payroll must be approved before marking as paid')
        }

        // Create Pengeluaran entry in Finance module
        const pengeluaran = await prisma.pengeluaran.create({
            data: {
                tanggal: new Date(),
                kategori: 'GAJI_KARYAWAN',
                tipePengeluaran: 'OPEX',
                jumlah: payroll.totalNet,
                deskripsi: `Gaji karyawan bulan ${this.getMonthName(payroll.month)} ${payroll.year} - ${payroll.totalEmployees} karyawan`,
                metodeBayar: 'TRANSFER',
                createdBy: paidBy,
            },
        })

        // Update payroll status
        await prisma.payroll.update({
            where: { id: payrollId },
            data: {
                status: 'PAID',
                paidAt: new Date(),
                paidBy,
                pengeluaranId: pengeluaran.id,
            },
        })
    }

    private getMonthName(month: number): string {
        const months = [
            'Januari',
            'Februari',
            'Maret',
            'April',
            'Mei',
            'Juni',
            'Juli',
            'Agustus',
            'September',
            'Oktober',
            'November',
            'Desember',
        ]
        return months[month - 1]
    }
}
