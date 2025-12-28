import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'
import { hasPermission } from '@/lib/rbac'

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAdmin(request)
        if (session instanceof NextResponse) {
            return session
        }

        if (!await hasPermission('attendance:delete')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { id } = await params

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 })
        }

        // Optional: Check if exists first, or just delete
        await prisma.attendance.delete({
            where: { id }
        })

        return NextResponse.json({ success: true, message: 'Attendance deleted successfully' })

    } catch (error: any) {
        console.error('Error deleting attendance:', error)
        if (error.code === 'P2025') {
            return NextResponse.json({ error: 'Data not found' }, { status: 404 })
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAdmin(request)
        if (session instanceof NextResponse) {
            return session
        }

        if (!await hasPermission('attendance:update')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { id } = await params
        const body = await request.json()
        const { checkIn, checkOut, status, notes } = body

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 })
        }

        // Prepare update data
        // Fetch existing attendance to get userId and User details
        const existingAttendance = await prisma.attendance.findUnique({
            where: { id },
            include: { user: true }
        })

        if (!existingAttendance) {
            return NextResponse.json({ error: 'Data not found' }, { status: 404 })
        }

        // Prepare update data
        const updateData: any = {}
        if (checkIn) updateData.checkIn = new Date(checkIn)
        if (checkOut) updateData.checkOut = new Date(checkOut)
        if (notes !== undefined) updateData.notes = notes

        // Auto-calculate status if checkIn changes
        if (checkIn && existingAttendance.user.startWorkTime) {
            const userDetails = existingAttendance.user

            // Fetch Tolerance Setting and Timezone
            const [toleranceSetting, timezoneSetting] = await Promise.all([
                prisma.settings.findFirst({
                    where: { key: 'GENERAL_ATTENDANCE_TOLERANCE' }
                }),
                prisma.settings.findFirst({
                    where: { key: 'GENERAL_TIMEZONE' }
                })
            ])

            const toleranceMinutes = toleranceSetting?.value ? parseInt(toleranceSetting.value) : 0
            const timezone = timezoneSetting?.value || 'Asia/Jakarta'

            const [schedHour, schedMinute] = userDetails.startWorkTime!.split(':').map(Number)

            // 1. Parse the new checkIn time
            // The checkIn coming from body is likely ISO string (e.g. 2025-12-23T06:18:00Z)
            const checkInDate = new Date(checkIn)

            // 2. Convert checkIn to Wall Clock Time in Target Timezone
            const checkInInTz = new Date(checkInDate.toLocaleString('en-US', { timeZone: timezone }))

            // 3. Create Schedule for THAT day (in Timezone Context)
            // We use checkInInTz (which represents the local day) to set the schedule
            const scheduleTime = new Date(checkInInTz)
            // Reset to HH:mm:00 based on startWorkTime
            scheduleTime.setHours(schedHour, schedMinute, 0, 0)

            const toleranceMs = toleranceMinutes * 60 * 1000
            const lateThreshold = new Date(scheduleTime.getTime() + toleranceMs)

            // Determine status by comparing "Wall Clock" times
            updateData.status = checkInInTz > lateThreshold ? 'LATE' : 'ON_TIME'
        } else if (status) {
            // If checkIn didn't change (or user has no schedule), allow manual status update
            updateData.status = status
        }

        const updated = await prisma.attendance.update({
            where: { id },
            data: updateData
        })

        return NextResponse.json({ success: true, data: updated })

    } catch (error: any) {
        console.error('Error updating attendance:', error)
        if (error.code === 'P2025') {
            return NextResponse.json({ error: 'Data not found' }, { status: 404 })
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
