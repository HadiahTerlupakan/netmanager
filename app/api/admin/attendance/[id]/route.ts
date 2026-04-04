import { prisma } from '@/modules/database'
import { Prisma } from '@prisma/client'
import { isSuperAdmin, getUserPermissions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api'
import { attendanceUpdateSchema } from '@/lib/validations/attendance'
import { idSchema } from '@/lib/validations/common'
import { logActivitySafe } from '@/lib/logger'

// GET /api/admin/attendance/[id]
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('attendance:read')) {
        return ApiErrors.forbidden('Akses ditolak')
    }

    const { id } = ctx.params
    const user = ctx.session!.user

    // Validate ID format
    const parseResult = idSchema.safeParse(id)
    if (!parseResult.success) {
        return apiError('ID tidak valid', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    // Fetch attendance with user details
    const attendance = await prisma.attendance.findUnique({
        where: { id: parseResult.data },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                    siteId: true,
                    departmentId: true,
                    departments: { select: { name: true } },
                    sites: { select: { name: true } }
                }
            }
        }
    })

    if (!attendance) {
        return ApiErrors.notFound('Data absensi tidak ditemukan')
    }

    // Access Control
    const permissions = await getUserPermissions(user.id)
    const isSuper = isSuperAdmin(user)

    if (!isSuper) {
        // We can check against the fetched record directly without pre-fetching user details again 
        // since we just need to compare with current user's claims. 
        // But `user` from session doesn't have siteId/deptId. We need to fetch it.
        const { prisma: db } = await import('@/modules/database');
        const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { siteId: true, departmentId: true } });

        if (permissions.includes('attendance:site_only') && dbUser?.siteId) {
            if (attendance.user.siteId !== dbUser.siteId) {
                return ApiErrors.notFound('Data absensi tidak ditemukan')
            }
        }
        if (permissions.includes('attendance:department_only') && dbUser?.departmentId) {
            if (attendance.user.departmentId !== dbUser.departmentId) {
                return ApiErrors.notFound('Data absensi tidak ditemukan')
            }
        }
    }

    return apiSuccess(attendance)
})

// PATCH /api/admin/attendance/[id]
export const PATCH = createHandler({ 
    auth: true, 
    schema: attendanceUpdateSchema 
}, async (req, ctx) => {
    if (!await hasPermission('attendance:update')) {
        return ApiErrors.forbidden('Akses ditolak')
    }

    const { id } = ctx.params
    const user = ctx.session!.user
    const { checkIn, checkOut, status, notes } = ctx.validated

    // Fetch existing attendance
    const existingAttendance = await prisma.attendance.findUnique({
        where: { id },
        include: { user: true }
    })

    if (!existingAttendance) {
        return ApiErrors.notFound('Data absensi tidak ditemukan')
    }

    // Access Control
    const permissions = await getUserPermissions(user.id)
    const isSuper = isSuperAdmin(user)

    if (!isSuper) {
        const { prisma: db } = await import('@/modules/database');
        const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { siteId: true, departmentId: true } });

        if (permissions.includes('attendance:site_only') && dbUser?.siteId) {
            if (existingAttendance.user.siteId !== dbUser.siteId) {
                return ApiErrors.notFound('Data absensi tidak ditemukan')
            }
        }
        if (permissions.includes('attendance:department_only') && dbUser?.departmentId) {
            if (existingAttendance.user.departmentId !== dbUser.departmentId) {
                return ApiErrors.notFound('Data absensi tidak ditemukan')
            }
        }
    }

    // Prepare update data
    const updateData: Prisma.AttendanceUpdateInput = {}
    if (checkIn) updateData.checkIn = new Date(checkIn)
    if (checkOut !== undefined) updateData.checkOut = checkOut ? new Date(checkOut) : null
    if (notes !== undefined) updateData.notes = notes

    // Auto-calculate status if checkIn changes
    if (checkIn && existingAttendance.user.startWorkTime && existingAttendance.user.workingHourMode !== 'FLEXIBLE') {
        const userDetails = existingAttendance.user

        const [toleranceSetting, timezoneSetting] = await Promise.all([
            prisma.settings.findFirst({ where: { key: 'GENERAL_ATTENDANCE_TOLERANCE' } }),
            prisma.settings.findFirst({ where: { key: 'GENERAL_TIMEZONE' } })
        ])

        const toleranceMinutes = toleranceSetting?.value ? parseInt(toleranceSetting.value) : 0
        const timezone = timezoneSetting?.value || 'Asia/Jakarta'

        const parts = userDetails.startWorkTime!.split(':')
        const schedHour = Number(parts[0]) || 0
        const schedMinute = Number(parts[1]) || 0

        const checkInDate = new Date(checkIn)
        const checkInInTz = new Date(checkInDate.toLocaleString('en-US', { timeZone: timezone }))

        const scheduleTime = new Date(checkInInTz)
        scheduleTime.setHours(schedHour, schedMinute, 0, 0)

        const toleranceMs = toleranceMinutes * 60 * 1000
        const lateThreshold = new Date(scheduleTime.getTime() + toleranceMs)

        updateData.status = checkInInTz > lateThreshold ? 'LATE' : 'ON_TIME'
    } else if (status) {
        updateData.status = status
    }

    const updated = await prisma.attendance.update({
        where: { id },
        data: updateData,
        include: {
            user: {
                select: {
                    name: true,
                    email: true,
                    image: true,
                    departments: { select: { name: true } },
                    sites: { select: { name: true } }
                }
            }
        }
    })

    logActivitySafe({
        action: 'UPDATE',
        subject: 'Attendance',
        userId: user.id,
        details: { id, updates: updateData }
    })

    return apiSuccess(updated, { message: 'Absensi berhasil diperbarui' })
})

// DELETE /api/admin/attendance/[id]
export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('attendance:delete')) {
        return ApiErrors.forbidden('Akses ditolak')
    }

    const { id } = ctx.params
    const user = ctx.session!.user

    const existing = await prisma.attendance.findUnique({
        where: { id },
        include: { user: true }
    })

    if (!existing) {
        return ApiErrors.notFound('Data absensi tidak ditemukan')
    }

    // Access Control
    const permissions = await getUserPermissions(user.id)
    const isSuper = isSuperAdmin(user)

    if (!isSuper) {
        const { prisma: db } = await import('@/modules/database');
        const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { siteId: true, departmentId: true } });

        if (permissions.includes('attendance:site_only') && dbUser?.siteId) {
            if (existing.user.siteId !== dbUser.siteId) {
                return ApiErrors.notFound('Data absensi tidak ditemukan')
            }
        }
        if (permissions.includes('attendance:department_only') && dbUser?.departmentId) {
            if (existing.user.departmentId !== dbUser.departmentId) {
                return ApiErrors.notFound('Data absensi tidak ditemukan')
            }
        }
    }

    await prisma.attendance.delete({
        where: { id }
    })

    logActivitySafe({
        action: 'DELETE',
        subject: 'Attendance',
        userId: user.id,
        details: { id }
    })

    return apiSuccess({ id }, { message: 'Absensi berhasil dihapus' })
})
