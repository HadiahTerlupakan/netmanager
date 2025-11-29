import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { AttendanceRepository } from '@/lib/repositories/AttendanceRepository'

const attendanceRepo = new AttendanceRepository()

// POST /api/hris/attendance/check-out
export async function POST(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { attendanceId, latitude, longitude, note } = body

        if (!attendanceId) {
            return NextResponse.json({ error: 'Attendance ID is required' }, { status: 400 })
        }

        const attendance = await attendanceRepo.findById(attendanceId)
        if (!attendance) {
            return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 })
        }

        if (attendance.checkOutTime) {
            return NextResponse.json(
                { error: 'Already checked out', attendance },
                { status: 400 }
            )
        }

        const checkOutTime = new Date()

        // Calculate working hours
        let workingHours = 0
        if (attendance.checkInTime) {
            const diffMs = checkOutTime.getTime() - new Date(attendance.checkInTime).getTime()
            workingHours = diffMs / (1000 * 60 * 60) // Convert to hours
        }

        const data = {
            checkOutTime,
            checkOutLat: latitude || null,
            checkOutLng: longitude || null,
            checkOutNote: note || null,
            workingHours,
        }

        await attendanceRepo.checkOut(attendanceId, data)

        return NextResponse.json({
            success: true,
            checkOutTime,
            workingHours: workingHours.toFixed(2),
            message: 'Checked out successfully',
        })
    } catch (error: any) {
        console.error('Error checking out:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
