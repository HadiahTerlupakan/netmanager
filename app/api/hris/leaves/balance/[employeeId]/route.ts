import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { LeaveBalanceRepository } from '@/lib/repositories/LeaveRepository'

const balanceRepo = new LeaveBalanceRepository()

// GET /api/hris/leaves/balance/[employeeId]
export async function GET(req: NextRequest, { params }: { params: { employeeId: string } }) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())

        const balances = await balanceRepo.findByEmployee(params.employeeId, year)

        // Initialize if no balances exist
        if (balances.length === 0) {
            await balanceRepo.initializeYearlyBalance(params.employeeId, year)
            const newBalances = await balanceRepo.findByEmployee(params.employeeId, year)
            return NextResponse.json({ balances: newBalances })
        }

        return NextResponse.json({ balances })
    } catch (error: any) {
        console.error('Error fetching leave balance:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
