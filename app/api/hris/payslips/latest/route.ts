import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/hris/payslips/latest - Get latest payslip for current employee
export async function GET(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const employeeId = session.user?.employee?.id
        if (!employeeId) {
            return NextResponse.json({ error: 'Employee not found in session' }, { status: 404 })
        }

        // Get latest payslip (most recent payroll detail)
        const payslip = await prisma.payrollDetail.findFirst({
            where: { employeeId },
            include: {
                payroll: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        })

        if (!payslip) {
            return NextResponse.json({ payslip: null })
        }

        return NextResponse.json({ payslip })
    } catch (error: any) {
        console.error('Error fetching latest payslip:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
