import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { AttendanceRepository } from '@/lib/repositories/AttendanceRepository'
import { EmployeeRepository } from '@/lib/repositories/EmployeeRepository'
import { AttendanceStatus } from '@prisma/client'

const attendanceRepo = new AttendanceRepository()
const employeeRepo = new EmployeeRepository()

// POST /api/hris/attendance/check-in
export async function POST(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { employeeId, latitude, longitude, note } = body

        if (!employeeId) {
            return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 })
        }

        // Verify employee exists
        const employee = await employeeRepo.findByEmployeeId(employeeId)
        if (!employee) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
        }

        // Check if already checked in today
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const existing = await attendanceRepo.findByEmployeeAndDate(employee.id, today)
        if (existing && existing.checkInTime) {
            return NextResponse.json(
                { error: 'Already checked in today', attendance: existing },
                { status: 400 }
            )
        }

        const checkInTime = new Date()

        // Determine status based on time (example: late if after 9 AM)
        const hour = checkInTime.getHours()
        const isLate = hour >= 9 // Simple rule: late if check-in after 9 AM

        const data = {
            employeeId: employee.id,
            date: today,
            checkInTime,
            checkInLat: latitude || null,
            checkInLng: longitude || null,
            checkInNote: note || null,
            status: isLate ? AttendanceStatus.LATE : AttendanceStatus.PRESENT,
        }

        const result = await attendanceRepo.create(data)

        return NextResponse.json({
            success: true,
            attendanceId: result.id,
            checkInTime,
            status: data.status,
            message: isLate ? 'Checked in - Late' : 'Checked in successfully',
        }, { status: 201 })
    } catch (error: any) {
        console.error('Error checking in:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
