import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { LeaveBalanceRepository } from '@/lib/repositories/LeaveRepository'

const balanceRepo = new LeaveBalanceRepository()

// GET /api/hris/leaves/balance - Get leave balances for current employee
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

        const currentYear = new Date().getFullYear()
        const balancesArray = await balanceRepo.findByEmployee(employeeId, currentYear)

        // Transform array to object structure expected by frontend
        const balances: any = {
            annual: { total: 12, used: 0, remaining: 12 },
            sick: { total: 12, used: 0, remaining: 12 },
            pendingRequests: 0,
        }

        balancesArray.forEach((balance: any) => {
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

        return NextResponse.json({ balances })
    } catch (error: any) {
        console.error('Error fetching leave balance:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
