import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'
import { attendanceUpdateSchema } from '@/lib/validations/attendance'
import { logger } from '@/lib/logger'

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
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus absensi')
        }

        const { id } = await params

        if (!id) {
            return apiError('ID wajib diisi', ErrorCodes.MISSING_FIELD, { status: 400 })
        }

        // Check existence and ownership
        const existing = await prisma.attendance.findUnique({
            where: { id },
            include: { user: true }
        })

        if (!existing) {
            return ApiErrors.notFound('Data absensi')
        }

        // OWNERSHIP CHECK
        const user = session.user as any;
        const isSuperAdmin = user.role === 'SUPER_ADMIN';

        if (!isSuperAdmin) {
            const recordUser = existing.user;
            if (user.permissions?.includes('attendance:site_only') && recordUser.siteId !== user.siteId) {
                return ApiErrors.forbidden('Akses dibatasi hanya untuk site Anda')
            }
            if (user.permissions?.includes('attendance:department_only') && recordUser.departmentId !== user.departmentId) {
                return ApiErrors.forbidden('Akses dibatasi hanya untuk departemen Anda')
            }
        }

        await prisma.attendance.delete({
            where: { id }
        })

        // System Log
        try {
            await logger.logActivity({
                action: 'DELETE',
                subject: 'Attendance',
                userId: session.user.id,
                details: { id }
            })
        } catch (e) { console.error('Logging failed', e) }

        return apiSuccess({ id }, { message: 'Absensi berhasil dihapus' })

    } catch (error: any) {
        console.error('Error deleting attendance:', error)
        if (error.code === 'P2025') {
            return ApiErrors.notFound('Data absensi')
        }
        return ApiErrors.internalError('Gagal menghapus absensi')
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
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah absensi')
        }

        const { id } = await params

        if (!id) {
            return apiError('ID wajib diisi', ErrorCodes.MISSING_FIELD, { status: 400 })
        }

        // Parse and validate request body
        const body = await request.json()
        const parseResult = attendanceUpdateSchema.safeParse(body)

        if (!parseResult.success) {
            return apiError(
                'Data tidak valid',
                ErrorCodes.VALIDATION_ERROR,
                { status: 400, details: parseResult.error.flatten().fieldErrors }
            )
        }

        const { checkIn, checkOut, status, notes } = parseResult.data

        // Fetch existing attendance to get userId and User details
        const existingAttendance = await prisma.attendance.findUnique({
            where: { id },
            include: { user: true }
        })

        if (!existingAttendance) {
            return ApiErrors.notFound('Data absensi')
        }

        // OWNERSHIP CHECK
        const user = session.user as any;
        const isSuperAdmin = user.role === 'SUPER_ADMIN';
        if (!isSuperAdmin) {
            const recordUser = existingAttendance.user;
            if (user.permissions?.includes('attendance:site_only') && recordUser.siteId !== user.siteId) {
                return ApiErrors.forbidden('Akses dibatasi hanya untuk site Anda')
            }
            if (user.permissions?.includes('attendance:department_only') && recordUser.departmentId !== user.departmentId) {
                return ApiErrors.forbidden('Akses dibatasi hanya untuk departemen Anda')
            }
        }

        // Prepare update data
        const updateData: any = {}
        if (checkIn) updateData.checkIn = new Date(checkIn)
        if (checkOut !== undefined) updateData.checkOut = checkOut ? new Date(checkOut) : null
        if (notes !== undefined) updateData.notes = notes

        // Auto-calculate status if checkIn changes
        if (checkIn && existingAttendance.user.startWorkTime && existingAttendance.user.workingHourMode !== 'FLEXIBLE') {
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
            const checkInDate = new Date(checkIn)

            // 2. Convert checkIn to Wall Clock Time in Target Timezone
            const checkInInTz = new Date(checkInDate.toLocaleString('en-US', { timeZone: timezone }))

            // 3. Create Schedule for THAT day (in Timezone Context)
            const scheduleTime = new Date(checkInInTz)
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

        // System Log
        try {
            await logger.logActivity({
                action: 'UPDATE',
                subject: 'Attendance',
                userId: session.user.id,
                details: { id, updates: updateData }
            })
        } catch (e) { console.error('Logging failed', e) }

        return apiSuccess(updated, { message: 'Absensi berhasil diperbarui' })

    } catch (error: any) {
        console.error('Error updating attendance:', error)
        if (error.code === 'P2025') {
            return ApiErrors.notFound('Data absensi')
        }
        return ApiErrors.internalError('Gagal memperbarui absensi')
    }
}
