import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { PayrollService } from '@/lib/services/hris/payroll-service'

const payrollService = new PayrollService()

// GET /api/hris/payroll - List payroll records
export async function GET(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (session.user.role !== 'ADMIN' && session.user.role !== 'HR' && session.user.role !== 'FINANCE') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const year = searchParams.get('year')
        const status = searchParams.get('status')

        const where: any = {}
        if (year) where.year = parseInt(year)
        if (status) where.status = status

        const payrolls = await prisma.payroll.findMany({
            where,
            include: {
                _count: {
                    select: { payrollDetails: true },
                },
            },
            orderBy: [{ year: 'desc' }, { month: 'desc' }],
        })

        return NextResponse.json({ payrolls })
    } catch (error: any) {
        console.error('Error fetching payrolls:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}

// POST /api/hris/payroll - Calculate/process new payroll
export async function POST(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (session.user.role !== 'ADMIN' && session.user.role !== 'HR') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await req.json()
        const { month, year } = body

        if (!month || !year) {
            return NextResponse.json({ error: 'Month and year are required' }, { status: 400 })
        }

        // Check if payroll already exists
        const existing = await prisma.payroll.findUnique({
            where: { month_year: { month, year } },
        })

        if (existing) {
            return NextResponse.json({ error: 'Payroll for this period already exists' }, { status: 400 })
        }

        const payrollId = await payrollService.calculateMonthlyPayroll(month, year)

        return NextResponse.json({
            success: true,
            payrollId,
            message: 'Payroll calculated successfully'
        }, { status: 201 })
    } catch (error: any) {
        console.error('Error processing payroll:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
