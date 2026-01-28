import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, apiError, apiPaginated, ApiErrors, ErrorCodes } from '@/lib/api-response'
import { attendanceFilterSchema } from '@/lib/validations/attendance'

export async function GET(request: NextRequest) {
    try {
        const session = await requireAdmin(request)
        if (session instanceof NextResponse) {
            return session
        }

        // Permission check
        if (!await hasPermission('attendance:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat data absensi')
        }

        const { searchParams } = new URL(request.url)

        // Validate query params with Zod
        const parseResult = attendanceFilterSchema.safeParse({
            page: searchParams.get('page') || '1',
            limit: searchParams.get('limit') || '10',
            startDate: searchParams.get('startDate'),
            endDate: searchParams.get('endDate'),
            userId: searchParams.get('userId'),
            siteId: searchParams.get('siteId'),
            departmentId: searchParams.get('departmentId'),
            status: searchParams.get('status'),
            export: searchParams.get('export'),
        })

        if (!parseResult.success) {
            return apiError(
                'Parameter tidak valid',
                ErrorCodes.VALIDATION_ERROR,
                { status: 400, details: parseResult.error.flatten().fieldErrors }
            )
        }

        const { page, limit, startDate: startDateStr, endDate: endDateStr, userId, status, export: isExportStr } = parseResult.data
        let { siteId, departmentId } = parseResult.data

        const skip = (page - 1) * limit

        // NEW: Enforce RBAC Restrictions
        const user = session.user as any;
        const isSuperAdmin = user.role === 'SUPER_ADMIN';

        // Existing attendance restrictions
        if (user.permissions?.includes('attendance:site_only') && !isSuperAdmin) {
            siteId = user.siteId;
        }
        if (user.permissions?.includes('attendance:department_only') && !isSuperAdmin) {
            departmentId = user.departmentId;
        }

        const where: any = {}

        if (startDateStr && endDateStr) {
            const start = new Date(startDateStr)
            start.setHours(0, 0, 0, 0)
            const end = new Date(endDateStr)
            end.setHours(23, 59, 59, 999)

            where.checkIn = { gte: start, lte: end }
        } else if (startDateStr) {
            const start = new Date(startDateStr)
            start.setHours(0, 0, 0, 0)
            const end = new Date(startDateStr)
            end.setHours(23, 59, 59, 999)

            where.checkIn = { gte: start, lte: end }
        }

        // Apply filters to User relation
        if (userId || siteId || departmentId) {
            where.user = {
                ...(userId && { id: userId }),
                ...(siteId && { siteId }),
                ...(departmentId && { departmentId })
            }
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

            const csvContent = csvRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')

            return new NextResponse(csvContent, {
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="absensi-${startDateStr || 'all'}-${endDateStr || 'all'}.csv"`
                }
            })
        }

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

        // Use standard paginated response
        return apiSuccess({
            attendances,
            summary
        }, {
            headers: {
                'X-Total-Count': total.toString(),
                'X-Page': page.toString(),
                'X-Limit': limit.toString(),
                'X-Total-Pages': Math.ceil(total / limit).toString()
            }
        })

    } catch (error: any) {
        console.error('Error fetching admin attendance:', error)
        return ApiErrors.internalError('Gagal mengambil data absensi')
    }
}
