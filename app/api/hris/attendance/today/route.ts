import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { AttendanceRepository } from '@/lib/repositories/AttendanceRepository'

const attendanceRepo = new AttendanceRepository()

// GET /api/hris/attendance/today - Get today's attendance for current employee
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

        // Get today's attendance
        const today = new Date()
        const attendance = await attendanceRepo.findByEmployeeAndDate(employeeId, today)

        return NextResponse.json({ attendance })
    } catch (error: any) {
        console.error('Error fetching today attendance:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
