import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/employee/payslips - Get all payslips for current employee
export async function GET(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get employee from session or find by user email
        let employeeId = session.user?.employee?.id

        if (!employeeId && session.user?.email) {
            const employee = await prisma.employee.findFirst({
                where: { email: session.user.email }
            })
            employeeId = employee?.id
        }

        if (!employeeId) {
            return NextResponse.json({
                success: true,
                payslips: [],
                message: 'No employee record found'
            })
        }

        const payslips = await prisma.payrollDetail.findMany({
            where: { employeeId },
            include: {
                payroll: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        })

        // Transform data for frontend
        const formattedPayslips = payslips.map(p => ({
            id: p.id,
            month: p.payroll.month,
            year: p.payroll.year,
            basicSalary: p.basicSalary.toString(),
            allowances: p.allowances.toString(),
            overtimePay: '0', // Adjust if you have overtime field
            grossSalary: (BigInt(p.basicSalary) + BigInt(p.allowances)).toString(),
            tax: p.tax.toString(),
            insurance: '0', // Adjust if you have insurance field
            deductions: p.deductions.toString(),
            netSalary: p.netSalary.toString(),
            daysWorked: p.daysWorked,
            status: p.payroll.status,
        }))

        return NextResponse.json({
            success: true,
            payslips: formattedPayslips
        })
    } catch (error: any) {
        console.error('Error fetching payslips:', error)
        return NextResponse.json({
            error: error.message || 'Internal server error',
            success: false
        }, { status: 500 })
    }
}
