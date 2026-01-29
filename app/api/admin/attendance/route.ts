/**
 * Admin Attendance Routes
 * Migrated to use standardized middleware and validation
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, withPermission, withErrorHandler, applyRBACRestrictions, withRateLimit, RateLimits } from '@/lib/middleware'
import { apiSuccess, apiPaginatedWithSummary } from '@/lib/api-response'
import { attendanceFilterSchema } from '@/lib/validations/attendance'
import { ValidationError } from '@/lib/middleware/error-handler'

export const GET = withErrorHandler(
  withAuth(
    withPermission('attendance:read',
      applyRBACRestrictions(
        { 
          sitePermission: 'attendance:site_only', 
          departmentPermission: 'attendance:department_only' 
        },
        withRateLimit(RateLimits.STANDARD,
          async ({ user, request, filters }) => {
            // filters is already sanitized by applyRBACRestrictions using parseQuery
            
            // Validate query params with Zod
            const parseResult = attendanceFilterSchema.safeParse(filters)

            if (!parseResult.success) {
              throw new ValidationError('Parameter tidak valid', parseResult.error.flatten().fieldErrors)
            }

            const { page, limit, startDate: startDateStr, endDate: endDateStr, userId, status, export: isExportStr } = parseResult.data

            const skip = (page - 1) * limit

            const where: any = {}

            // Apply date range filter
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

            // Apply filters to User relation (includes RBAC restrictions from middleware)
            if (userId || filters.siteId || filters.departmentId) {
              where.user = {
                ...(userId && { id: userId }),
                ...(filters.siteId && { siteId: filters.siteId }),
                ...(filters.departmentId && { departmentId: filters.departmentId })
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
          }
        )
      )
    )
  )
)
