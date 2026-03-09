import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { apiPaginatedWithSummary, ApiErrors } from '@/lib/api-response'
import { attendanceFilterSchema } from '@/lib/validations/attendance'
import { createHandler } from '@/lib/api'
import { getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { toStartOfDay, toEndOfDay } from '@/lib/utils/datetime'


/**
 * Admin Attendance Routes
 * Migrated to use standardized middleware and validation
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user

    // 1. Permission Check
    if (!(await hasPermission("attendance:read"))) {
        return ApiErrors.forbidden('Akses ditolak')
    }

    // 2. Validate Query Params
    const { searchParams } = req.nextUrl
    const queryParams = Object.fromEntries(searchParams.entries())

    const parseResult = attendanceFilterSchema.safeParse(queryParams)
    if (!parseResult.success) {
        return ApiErrors.badRequest('Parameter tidak valid', { errors: parseResult.error.flatten().fieldErrors })
    }

    const { page, limit, startDate: startDateStr, endDate: endDateStr, userId, siteId, departmentId, status, search, export: isExportStr } = parseResult.data
    const skip = (page - 1) * limit

    const where: Prisma.AttendanceWhereInput = {}

    // 3. Apply RBAC Restrictions
    const permissions = await getUserPermissions(user.id);
    const isSuper = isSuperAdmin(user);

    // Fetch user siteId/deptId if needed
    let restrictedSiteId: string | undefined
    let restrictedDeptId: string | undefined

    if (!isSuper) {
        if (permissions.includes('attendance:site_only')) {
            const { prisma: db } = await import('@/lib/prisma');
            const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { siteId: true, departmentId: true } });
            restrictedSiteId = dbUser?.siteId || undefined
            // Also restrict department if needed? usually site restriction implies viewing all depts in site, unless dept restriction also exists
        }
        if (permissions.includes('attendance:department_only')) {
            const { prisma: db } = await import('@/lib/prisma');
            const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { departmentId: true } });
            restrictedDeptId = dbUser?.departmentId || undefined
        }
    }

    // Apply date range filter
    if (startDateStr && endDateStr) {
        const start = new Date(startDateStr)
        start.setTime(toStartOfDay(start).getTime())
        const end = new Date(endDateStr)
        end.setTime(toEndOfDay(end).getTime())
        where.checkIn = { gte: start, lte: end }
    } else if (startDateStr) {
        const start = new Date(startDateStr)
        start.setTime(toStartOfDay(start).getTime())
        const end = new Date(startDateStr)
        end.setTime(toEndOfDay(end).getTime())
        where.checkIn = { gte: start, lte: end }
    }

    // Apply filters to User relation (combining explicit filters + RBAC)
    const userWhere: Prisma.UserWhereInput = {}

    if (userId) userWhere.id = userId

    // Site Logic: RBAC Restricts First, Explicit input fallback
    if (restrictedSiteId) {
        userWhere.siteId = restrictedSiteId
    } else if (siteId) {
        userWhere.siteId = siteId
    }

    // Department Logic: RBAC Restricts First, Explicit input fallback
    if (restrictedDeptId) {
        userWhere.departmentId = restrictedDeptId
    } else if (departmentId) {
        userWhere.departmentId = departmentId
    }

    if (search) {
        userWhere.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } }
        ]
    }

    // Only add 'user' to where clause if we have user filters
    if (Object.keys(userWhere).length > 0) {
        where.user = userWhere
    }

    // Apply status filter if provided
    if (status) {
        where.status = status
    }

    // Check for export flag
    const isExport = isExportStr === 'true'

    if (isExport) {
        // Fetch Timezone Setting
        const timezoneSetting = await prisma.settings.findFirst({
            where: { key: 'GENERAL_TIMEZONE' }
        })
        const timezone = timezoneSetting?.value || 'Asia/Jakarta'

        const attendances = await prisma.attendance.findMany({
            where,
            include: {
                user: {
                    select: {
                        name: true,
                        departments: { select: { name: true } },
                        sites: { select: { name: true } }
                    }
                }
            },
            orderBy: { checkIn: 'desc' }
        })

        // Generate CSV
        const csvRows = [
            ['No', 'Karyawan', 'Site', 'Departemen', 'Tanggal', 'Jam Masuk', 'Jam Pulang', 'Status', 'Keterangan']
        ]

        attendances.forEach((item, index) => {
            const checkInDate = new Date(item.checkIn)
            const checkOutDate = item.checkOut ? new Date(item.checkOut) : null

            // Formatter options
            const dateOptions: Intl.DateTimeFormatOptions = {
                timeZone: timezone,
                day: '2-digit', month: '2-digit', year: 'numeric'
            }
            const timeOptions: Intl.DateTimeFormatOptions = {
                timeZone: timezone,
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: false
            }

            csvRows.push([
                (index + 1).toString(),
                item.user.name || '-',
                item.user.sites?.name || '-',
                item.user.departments?.name || '-',
                checkInDate.toLocaleDateString('id-ID', dateOptions),
                checkInDate.toLocaleTimeString('id-ID', timeOptions).replace(/\./g, ':'),
                checkOutDate ? checkOutDate.toLocaleTimeString('id-ID', timeOptions).replace(/\./g, ':') : '-',
                item.status,
                item.notes || '-'
            ])
        })

        const sanitizeCSV = (value: string) => {
            if (typeof value === 'string' && /^[=+\-@]/.test(value)) {
                return `'${value}`
            }
            return value
        }

        const csvContent = csvRows.map(row => row.map(cell => `"${sanitizeCSV(cell)}"`).join(',')).join('\n')

        return new NextResponse(csvContent, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="absensi-${startDateStr || 'all'}-${endDateStr || 'all'}.csv"`
            }
        })
    }

    // Regular pagination response
    const [attendances, total, statusSummary] = await Promise.all([
        prisma.attendance.findMany({
            where,
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
            },
            orderBy: { checkIn: 'desc' },
            take: limit,
            skip
        }),
        prisma.attendance.count({ where }),
        prisma.attendance.groupBy({
            by: ['status'],
            where,
            _count: {
                _all: true
            }
        })
    ])

    // Format summary
    const summary = statusSummary.reduce((acc, curr) => {
        acc[curr.status] = curr._count._all
        return acc
    }, {} as Record<string, number>)

    // Use standardized paginated response with summary
    return apiPaginatedWithSummary(attendances, {
        page,
        limit,
        total,
        summary
    })
})
