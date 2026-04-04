import { NextResponse } from 'next/server'
import { prisma } from '@/modules/database'
import { Prisma } from '@prisma/client'
import { apiPaginatedWithSummary, ApiErrors } from '@/lib/api-response'
import { attendanceFilterSchema } from '@/lib/validations/attendance'
import { createHandler } from '@/lib/api'
import { getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getDayOffDisplayLabel, getPermitDisplayLabel, isHistoricalAutoCheckoutAbsence } from '@/lib/attendance-display'
import { toStartOfDay, toEndOfDay } from '@/lib/utils/server-datetime'
import { getTimezone } from '@/lib/utils/get-timezone'
import { LeaveService } from '@/modules/attendance'
import { AbsenceService } from '@/modules/attendance'

/**
 * Admin Attendance Routes
 * Fully database-driven pagination and filtering.
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user
    const tenantId = user.tenantId

    if (!tenantId) {
        return ApiErrors.badRequest('Tenant ID tidak ditemukan')
    }

    const timezone = await getTimezone(tenantId)

    if (!(await hasPermission("attendance:read"))) {
        return ApiErrors.forbidden('Akses ditolak')
    }

    const { searchParams } = req.nextUrl
    const queryParams = Object.fromEntries(searchParams.entries())

    const parseResult = attendanceFilterSchema.safeParse(queryParams)
    if (!parseResult.success) {
        return ApiErrors.badRequest('Parameter tidak valid', { errors: parseResult.error.flatten().fieldErrors })
    }

    const { page, limit, startDate: startDateStr, endDate: endDateStr, userId, siteId, departmentId, status, statusDetail, search, export: isExportStr } = parseResult.data
    const skip = (page - 1) * limit

    const where: Prisma.AttendanceWhereInput = { tenantId }

    const permissions = await getUserPermissions(user.id);
    const isSuper = isSuperAdmin(user);

    let restrictedSiteId: string | undefined
    let restrictedDeptId: string | undefined

    if (!isSuper) {
        if (permissions.includes('attendance:site_only')) {
            const { prisma: db } = await import('@/modules/database');
            const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { siteId: true, departmentId: true } });
            restrictedSiteId = dbUser?.siteId || undefined
        }
        if (permissions.includes('attendance:department_only')) {
            const { prisma: db } = await import('@/modules/database');
            const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { departmentId: true } });
            restrictedDeptId = dbUser?.departmentId || undefined
        }
    }

    let rangeStart: Date | null = null
    let rangeEnd: Date | null = null

    if (startDateStr && endDateStr) {
        rangeStart = toStartOfDay(startDateStr, timezone)
        rangeEnd = toEndOfDay(endDateStr, timezone)
        where.checkIn = { gte: rangeStart, lte: rangeEnd }
    } else if (startDateStr) {
        rangeStart = toStartOfDay(startDateStr, timezone)
        rangeEnd = toEndOfDay(startDateStr, timezone)
        where.checkIn = { gte: rangeStart, lte: rangeEnd }
    }

    if (rangeStart && rangeEnd) {
        const leaveService = new LeaveService()
        const absenceService = new AbsenceService()

        await leaveService.syncApprovedLeaveToAttendanceRange(rangeStart, rangeEnd, tenantId, userId)
        await absenceService.syncDayOffAttendanceRange(rangeStart, rangeEnd, tenantId, userId)
    }

    const userWhere: Prisma.UserWhereInput = {}
    if (userId) userWhere.id = userId
    if (restrictedSiteId) userWhere.siteId = restrictedSiteId
    else if (siteId) userWhere.siteId = siteId
    if (restrictedDeptId) userWhere.departmentId = restrictedDeptId
    else if (departmentId) userWhere.departmentId = departmentId

    if (search) {
        userWhere.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } }
        ]
    }

    if (Object.keys(userWhere).length > 0) where.user = userWhere
    if (status) where.status = status

    if (statusDetail) {
        switch (statusDetail) {
            case 'ON_TIME':
            case 'LATE':
            case 'SICK':
                where.status = statusDetail
                break
            case 'ABSENT':
                where.AND = [
                    { status: { in: ['ALPHA', 'ABSENT'] } },
                    {
                        NOT: {
                            AND: [
                                { status: { in: ['ALPHA', 'ABSENT'] } },
                                { checkOut: { not: null } },
                                {
                                    OR: [
                                        { notes: { contains: 'Auto checkout by system (Mangkir)' } },
                                        { notes: { contains: 'Lupa Absen Pulang' } },
                                    ]
                                }
                            ]
                        }
                    }
                ]
                break
            case 'NO_CHECKOUT':
                where.OR = [
                    { status: 'NO_CHECKOUT' },
                    {
                        AND: [
                            { status: { in: ['ALPHA', 'ABSENT'] } },
                            { checkOut: { not: null } },
                            {
                                OR: [
                                    { notes: { contains: 'Auto checkout by system (Mangkir)' } },
                                    { notes: { contains: 'Lupa Absen Pulang' } },
                                ]
                            }
                        ]
                    }
                ]
                break
            case 'CUTI':
                where.status = 'PERMIT'
                where.notes = { contains: '(CUTI)' }
                break
            case 'IZIN':
                where.status = 'PERMIT'
                where.notes = { contains: '(IZIN)' }
                break
            case 'TUKAR_LIBUR':
                where.status = 'DAY_OFF'
                where.OR = [
                    { notes: { contains: 'Auto-generated from Leave Request' } },
                    { notes: { contains: 'Updated by Leave Approval' } },
                ]
                break
            case 'HARI_LIBUR':
                where.status = 'DAY_OFF'
                where.notes = { contains: 'Hari Libur (Day Off)' }
                break
            case 'HARI_OFF':
                where.status = 'DAY_OFF'
                where.notes = { contains: 'Hari Off (Day Off)' }
                break
        }
    }

    const isExport = isExportStr === 'true'

    const includeUser = {
        user: {
            select: {
                name: true,
                email: true,
                image: true,
                workingHourMode: true,
                workDays: true,
                departments: { select: { name: true } },
                sites: { select: { name: true } }
            }
        }
    }

    if (isExport) {
        const allAttendances = await prisma.attendance.findMany({
            where,
            include: includeUser,
            orderBy: { checkIn: 'desc' }
        })

        const csvRows = [['No', 'Karyawan', 'Site', 'Departemen', 'Tanggal', 'Jam Masuk', 'Jam Pulang', 'Status', 'Keterangan']]
        
        allAttendances.forEach((item, index) => {
            const checkInDate = new Date(item.checkIn)
            const checkOutDate = item.checkOut ? new Date(item.checkOut) : null
            const dateOptions: Intl.DateTimeFormatOptions = { timeZone: timezone, day: '2-digit', month: '2-digit', year: 'numeric' }
            const timeOptions: Intl.DateTimeFormatOptions = { timeZone: timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }
            const isHistoricalNoCheckout = isHistoricalAutoCheckoutAbsence(item)

            let displayStatus = item.status as string
            if (item.status === 'SICK') displayStatus = 'SAKIT'
            else if (item.status === 'PERMIT') displayStatus = getPermitDisplayLabel(item).toUpperCase()
            else if (item.status === 'DAY_OFF') displayStatus = getDayOffDisplayLabel(item).toUpperCase()
            else if (item.status === 'ALPHA' || item.status === 'ABSENT') {
                if (isHistoricalNoCheckout) {
                    displayStatus = 'TIDAK CHECKOUT'
                } else {
                    displayStatus = 'TIDAK HADIR'
                    if (item.checkIn && !item.checkOut && !item.notes?.includes('Tanpa Keterangan') && !item.notes?.includes('Leave')) {
                        displayStatus = 'BELUM CHECKOUT'
                    }
                }
            }
            else if (item.status === 'NO_CHECKOUT') displayStatus = 'TIDAK CHECKOUT'
            else if (item.status === 'ON_TIME') displayStatus = 'TEPAT WAKTU'
            else if (item.status === 'LATE') displayStatus = 'TERLAMBAT'

            // Special marker for leave/system-generated items formatting
            const isAbsentOrLeave = ['ALPHA', 'ABSENT', 'SICK', 'PERMIT', 'DAY_OFF'].includes(item.status) && !isHistoricalNoCheckout
            
            const checkInStr = isAbsentOrLeave ? '-' : checkInDate.toLocaleTimeString('id-ID', timeOptions).replace(/\./g, ':')
            // For NO_CHECKOUT, checkout was auto-generated or missing, so display '-'
            const checkOutStr = (isAbsentOrLeave || item.status === 'NO_CHECKOUT' || isHistoricalNoCheckout || !checkOutDate) ? '-' : checkOutDate.toLocaleTimeString('id-ID', timeOptions).replace(/\./g, ':')

            csvRows.push([
                (index + 1).toString(),
                item.user.name || '-',
                item.user.sites?.name || '-',
                item.user.departments?.name || '-',
                checkInDate.toLocaleDateString('id-ID', dateOptions),
                checkInStr,
                checkOutStr,
                displayStatus,
                item.notes || '-'
            ])
        })

        const sanitizeCSV = (value: string) => (typeof value === 'string' && /^[=+\-@]/.test(value)) ? `'${value}` : value
        const csvContent = csvRows.map(row => row.map(cell => `"${sanitizeCSV(cell)}"`).join(',')).join('\n')
        
        return new NextResponse(csvContent, { 
            headers: { 
                'Content-Type': 'text/csv', 
                'Content-Disposition': `attachment; filename="absensi.csv"` 
            } 
        })
    }

    const [paginatedData, total, statusGroups] = await Promise.all([
        prisma.attendance.findMany({
            where,
            include: includeUser,
            orderBy: { checkIn: 'desc' },
            skip,
            take: limit
        }),
        prisma.attendance.count({ where }),
        prisma.attendance.groupBy({ by: ['status'], where, _count: { _all: true } })
    ])

    const summary = statusGroups.reduce((acc, curr) => {
        acc[curr.status] = curr._count._all
        return acc
    }, {} as Record<string, number>)

    return apiPaginatedWithSummary(paginatedData, { page, limit, total, summary })
})
