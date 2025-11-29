import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/hris/payslips - Get all payslips for current employee
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

        // Get all payslips for this employee
        const payslips = await prisma.payrollDetail.findMany({
            where: { employeeId },
            include: {
                payroll: {
                    select: {
                        id: true,
                        month: true,
                        year: true,
                        status: true,
                        paidAt: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        })

        return NextResponse.json({ payslips })
    } catch (error: any) {
        console.error('Error fetching payslips:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
