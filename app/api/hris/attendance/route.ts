import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { AttendanceRepository } from '@/lib/repositories/AttendanceRepository'

const attendanceRepo = new AttendanceRepository()

// GET /api/hris/attendance - List attendance records
export async function GET(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const employeeId = searchParams.get('employeeId') || undefined
        const date = searchParams.get('date')
        const startDate = searchParams.get('startDate')
        const endDate = searchParams.get('endDate')
        const status = searchParams.get('status') as any

        let attendances

        if (date) {
            // Get attendance for specific date
            attendances = await attendanceRepo.findByDate(new Date(date))
        } else if (startDate && endDate) {
            // Get attendance for date range
            attendances = await attendanceRepo.findByDateRange(new Date(startDate), new Date(endDate))
        } else {
            // Get all with filters
            const filters = {
                employeeId,
                status,
            }
            attendances = await attendanceRepo.findAll(filters)
        }

        const total = await attendanceRepo.count({ employeeId, status })

        return NextResponse.json({ attendances, total })
    } catch (error: any) {
        console.error('Error fetching attendance:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
