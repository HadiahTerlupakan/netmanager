import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'
import { hasPermission } from '@/lib/rbac'

export async function GET(request: NextRequest) {
    try {
        const session = await requireAdmin(request)
        if (session instanceof NextResponse) {
            return session
        }

        // Permission check
        if (!await hasPermission('attendance:read')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '10')
        const skip = (page - 1) * limit

        const startDateStr = searchParams.get('startDate')
        const endDateStr = searchParams.get('endDate')
        const userId = searchParams.get('userId')
        const status = searchParams.get('status') // Added status search param
        let siteId = searchParams.get('siteId')
        let departmentId = searchParams.get('departmentId')

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
        const isExport = searchParams.get('export') === 'true'

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

                // Format dates to parts to match dd/mm/yyyy format explicitly if needed, or rely on locale
                // 'id-ID' usually gives dd/mm/yyyy.

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

        return NextResponse.json({
            success: true,
            data: attendances,
            summary,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        })

    } catch (error: any) {
        console.error('Error fetching admin attendance:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
