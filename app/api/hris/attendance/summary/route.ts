import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { AttendanceRepository } from '@/lib/repositories/AttendanceRepository'

const attendanceRepo = new AttendanceRepository()

// GET /api/hris/attendance/summary - Get attendance summary for current employee
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

        // Get summary for current month
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

        const records = await attendanceRepo.findByEmployee(
            employeeId,
            startOfMonth,
            endOfMonth
        )

        // Calculate summary
        const summary = {
            thisMonth: records.length,
            present: records.filter(r => r.status === 'PRESENT').length,
            late: records.filter(r => r.status === 'LATE').length,
            absent: records.filter(r => r.status === 'ABSENT').length,
        }

        return NextResponse.json({ summary })
    } catch (error: any) {
        console.error('Error fetching attendance summary:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
