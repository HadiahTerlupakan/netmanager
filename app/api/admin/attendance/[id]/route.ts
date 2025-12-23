
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAdmin(request)
        if (session instanceof NextResponse) {
            return session
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

            // Fetch Tolerance Setting
            const toleranceSetting = await prisma.settings.findFirst({
                where: { key: 'GENERAL_ATTENDANCE_TOLERANCE' }
            })
            const toleranceMinutes = toleranceSetting?.value ? parseInt(toleranceSetting.value) : 0

            const [schedHour, schedMinute] = userDetails.startWorkTime!.split(':').map(Number)
            const checkInDate = new Date(checkIn)

            // Create schedule time on the SAME DAY as the checkIn date
            const scheduleTime = new Date(checkInDate)
            scheduleTime.setHours(schedHour, schedMinute, 0, 0)

            const toleranceMs = toleranceMinutes * 60 * 1000
            const lateThreshold = new Date(scheduleTime.getTime() + toleranceMs)

            // Determine status
            updateData.status = checkInDate > lateThreshold ? 'LATE' : 'ON_TIME'
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
