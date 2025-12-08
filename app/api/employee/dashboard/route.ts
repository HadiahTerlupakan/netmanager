import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/employee/dashboard - Get dashboard data for current employee
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

        // Get today's date info
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

        // Prepare response data
        let attendanceSummary = {
            thisMonth: 0,
            present: 0,
            late: 0,
            absent: 0,
        }

        let leaveBalances = {
            annual: { total: 12, used: 0, remaining: 12 },
            sick: { total: 12, used: 0, remaining: 12 },
            pendingRequests: 0,
        }

        let latestPayslip = null
        let todayAttendance = null

        if (employeeId) {
            // Get attendance records for current month
            const attendanceRecords = await prisma.attendance.findMany({
                where: {
                    employeeId,
                    date: {
                        gte: startOfMonth,
                        lte: endOfMonth,
                    }
                }
            })

            attendanceSummary = {
                thisMonth: attendanceRecords.length,
                present: attendanceRecords.filter(r => r.status === 'PRESENT').length,
                late: attendanceRecords.filter(r => r.status === 'LATE').length,
                absent: attendanceRecords.filter(r => r.status === 'ABSENT').length,
            }

            // Get today's attendance
            todayAttendance = await prisma.attendance.findFirst({
                where: {
                    employeeId,
                    date: {
                        gte: startOfDay,
                        lte: endOfDay,
                    }
                }
            })

            // Get leave balances
            const currentYear = now.getFullYear()
            const balances = await prisma.leaveBalance.findMany({
                where: {
                    employeeId,
                    year: currentYear,
                }
            })

            balances.forEach((balance: any) => {
                if (balance.leaveType === 'ANNUAL') {
                    leaveBalances.annual = {
                        total: balance.totalDays,
                        used: balance.usedDays,
                        remaining: balance.remainingDays,
                    }
                } else if (balance.leaveType === 'SICK') {
                    leaveBalances.sick = {
                        total: balance.totalDays,
                        used: balance.usedDays,
                        remaining: balance.remainingDays,
                    }
                }
            })

            // Count pending leave requests
            const pendingRequests = await prisma.leaveRequest.count({
                where: {
                    employeeId,
                    status: 'PENDING',
                }
            })
            leaveBalances.pendingRequests = pendingRequests

            // Get latest payslip
            const payslip = await prisma.payrollDetail.findFirst({
                where: { employeeId },
                include: {
                    payroll: true,
                },
                orderBy: {
                    createdAt: 'desc',
                },
            })
            latestPayslip = payslip
        }

        return NextResponse.json({
            success: true,
            data: {
                attendanceSummary,
                leaveBalances,
                latestPayslip,
                todayAttendance,
            }
        })
    } catch (error: any) {
        console.error('Error fetching employee dashboard:', error)
        return NextResponse.json({
            error: error.message || 'Internal server error',
            success: false
        }, { status: 500 })
    }
}
