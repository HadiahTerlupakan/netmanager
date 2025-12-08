import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/employee/leaves - Get leave requests for current employee
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
                leaves: [],
                balances: {
                    annual: { total: 12, used: 0, remaining: 12 },
                    sick: { total: 12, used: 0, remaining: 12 },
                    pendingRequests: 0,
                }
            })
        }

        // Get leave requests
        const leaves = await prisma.leaveRequest.findMany({
            where: { employeeId },
            orderBy: { createdAt: 'desc' },
            take: 20,
        })

        // Get leave balances
        const currentYear = new Date().getFullYear()
        const balancesData = await prisma.leaveBalance.findMany({
            where: {
                employeeId,
                year: currentYear,
            }
        })

        const balances: any = {
            annual: { total: 12, used: 0, remaining: 12 },
            sick: { total: 12, used: 0, remaining: 12 },
            pendingRequests: 0,
        }

        balancesData.forEach((balance: any) => {
            if (balance.leaveType === 'ANNUAL') {
                balances.annual = {
                    total: balance.totalDays,
                    used: balance.usedDays,
                    remaining: balance.remainingDays,
                }
            } else if (balance.leaveType === 'SICK') {
                balances.sick = {
                    total: balance.totalDays,
                    used: balance.usedDays,
                    remaining: balance.remainingDays,
                }
            }
        })

        // Count pending requests
        balances.pendingRequests = leaves.filter(l => l.status === 'PENDING').length

        return NextResponse.json({
            success: true,
            leaves,
            balances,
        })
    } catch (error: any) {
        console.error('Error fetching leaves:', error)
        return NextResponse.json({
            error: error.message || 'Internal server error',
            success: false
        }, { status: 500 })
    }
}

// POST /api/employee/leaves - Create a new leave request
export async function POST(req: NextRequest) {
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
                error: 'No employee record found',
                success: false
            }, { status: 404 })
        }

        const body = await req.json()
        const { leaveType, startDate, endDate, reason } = body

        if (!leaveType || !startDate || !endDate || !reason) {
            return NextResponse.json({
                error: 'Missing required fields: leaveType, startDate, endDate, reason',
                success: false
            }, { status: 400 })
        }

        // Calculate days
        const start = new Date(startDate)
        const end = new Date(endDate)
        const diffTime = Math.abs(end.getTime() - start.getTime())
        const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1

        const leaveRequest = await prisma.leaveRequest.create({
            data: {
                employeeId,
                leaveType,
                startDate: start,
                endDate: end,
                totalDays,
                reason,
                status: 'PENDING',
            }
        })

        return NextResponse.json({
            success: true,
            message: 'Leave request submitted successfully',
            leaveRequest,
        })
    } catch (error: any) {
        console.error('Error creating leave request:', error)
        return NextResponse.json({
            error: error.message || 'Internal server error',
            success: false
        }, { status: 500 })
    }
}
