import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { apiPaginatedWithSummary, ApiErrors } from '@/lib/api-response'
import { attendanceFilterSchema } from '@/lib/validations/attendance'
import { createHandler } from '@/lib/api'
import { getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { toStartOfDay, toEndOfDay } from '@/lib/utils/server-datetime'
import { getTimezone } from '@/lib/utils/get-timezone'


/**
 * Admin Attendance Routes
 * Migrated to use standardized middleware and validation
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

    const { page, limit, startDate: startDateStr, endDate: endDateStr, userId, siteId, departmentId, status, search, export: isExportStr } = parseResult.data
    const skip = (page - 1) * limit

    const where: Prisma.AttendanceWhereInput = { tenantId }

    const permissions = await getUserPermissions(user.id);
    const isSuper = isSuperAdmin(user);

    let restrictedSiteId: string | undefined
    let restrictedDeptId: string | undefined

    if (!isSuper) {
        if (permissions.includes('attendance:site_only')) {
            const { prisma: db } = await import('@/lib/prisma');
            const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { siteId: true, departmentId: true } });
            restrictedSiteId = dbUser?.siteId || undefined
        }
        if (permissions.includes('attendance:department_only')) {
            const { prisma: db } = await import('@/lib/prisma');
            const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { departmentId: true } });
            restrictedDeptId = dbUser?.departmentId || undefined
        }
    }

    if (startDateStr && endDateStr) {
        where.checkIn = { gte: toStartOfDay(startDateStr, timezone), lte: toEndOfDay(endDateStr, timezone) }
    } else if (startDateStr) {
        where.checkIn = { gte: toStartOfDay(startDateStr, timezone), lte: toEndOfDay(startDateStr, timezone) }
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

    const isExport = isExportStr === 'true'

    const [allAttendances, _statusSummary, approvedLeaves, requiredUsers, holidays] = await Promise.all([
        prisma.attendance.findMany({
            where,
            include: {
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
            },
            orderBy: { checkIn: 'desc' }
        }),
        prisma.attendance.groupBy({ by: ['status'], where, _count: { _all: true } }),
        prisma.leaveRequest.findMany({
            where: {
                tenantId,
                status: 'APPROVED',
                startDate: startDateStr ? { gte: toStartOfDay(startDateStr, timezone) } : undefined,
                user: (Object.keys(userWhere).length > 0) ? userWhere : undefined
            },
            include: {
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
        }),
        prisma.user.findMany({
            where: {
                ...userWhere,
                tenantId,
                isAttendanceRequired: true,
                isActive: true
            },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                workingHourMode: true,
                workDays: true,
                departments: { select: { name: true } },
                sites: { select: { name: true } }
            }
        }),
        prisma.holiday.findMany({
            where: {
                tenantId,
                date: {
                    gte: startDateStr ? toStartOfDay(startDateStr, timezone) : undefined,
                    lte: endDateStr ? toEndOfDay(endDateStr, timezone) : undefined
                }
            }
        })
    ])

    const holidaySet = new Set<string>(holidays.map(h => {
        // Use Intl.DateTimeFormat to get date string in tenant's timezone
        return new Intl.DateTimeFormat('en-CA', { 
            timeZone: timezone, 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
        }).format(new Date(h.date))
    }))

    type MappedAttendance = (typeof allAttendances[0]) & { isLeave?: boolean, isVirtual?: boolean }

    // 1. Process Leaves into expanded days
    const leaveAttendances: MappedAttendance[] = []
    const leaveDateMap = new Set<string>() // Track user-date combinations that are leaves

    const dateFormatter = new Intl.DateTimeFormat('en-CA', { 
        timeZone: timezone, 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
    })

    approvedLeaves.forEach(leave => {
        const start = new Date(leave.startDate)
        start.setHours(0, 0, 0, 0)
        const end = new Date(leave.endDate)
        end.setHours(23, 59, 59, 999)
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const currentDayDate = dateFormatter.format(d)
            const currentDayStart = toStartOfDay(currentDayDate, timezone)
            const filterStart = startDateStr ? toStartOfDay(startDateStr, timezone) : null
            const filterEnd = endDateStr ? toEndOfDay(endDateStr, timezone) : null

            if (filterStart && currentDayStart < filterStart) continue
            if (filterEnd && currentDayStart > filterEnd) continue

            leaveAttendances.push({
                id: `leave-${leave.id}-${currentDayDate}`,
                userId: leave.userId,
                checkIn: new Date(d),
                checkOut: new Date(d),
                checkInPhoto: null,
                checkOutPhoto: null,
                status: leave.type === 'SAKIT' ? 'SICK' : 'PERMIT',
                notes: leave.reason,
                location: null,
                checkOutLocation: null,
                user: leave.user,
                isLeave: true,
                createdAt: leave.createdAt,
                updatedAt: leave.updatedAt,
                tenantId: leave.tenantId,
                geofenceStatus: null,
                geofenceDistance: null,
                geofenceSiteName: null,
                checkOutGeofenceStatus: null,
                checkOutGeofenceDistance: null,
                geofenceMeta: null
            } as MappedAttendance)

            // Mark this user as having a leave on this specific day
            leaveDateMap.add(`${leave.userId}-${currentDayDate}`)
        }
    })

    // 2. Track existing attendances
    const attendanceDateMap = new Set<string>()
    allAttendances.forEach(att => {
        const dateStr = dateFormatter.format(new Date(att.checkIn))
        attendanceDateMap.add(`${att.userId}-${dateStr}`)
    })

    // 3. Generate ABSENT records for missing work days
    const absentAttendances: MappedAttendance[] = []
    const startRange = startDateStr ? toStartOfDay(startDateStr, timezone) : toStartOfDay(new Date().toISOString(), timezone)
    const endRange = endDateStr ? toEndOfDay(endDateStr, timezone) : toEndOfDay(new Date().toISOString(), timezone)
    
    // Effective end is either the filter end or today
    const now = new Date()
    const effectiveEnd = endRange > now ? now : endRange
    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    requiredUsers.forEach(u => {
        const workDays = u.workDays?.split(',').map(d => d.trim()) || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
        
        // Loop from startRange to effectiveEnd
        for (let d = new Date(startRange); d <= effectiveEnd; d.setDate(d.getDate() + 1)) {
            const dateStr = dateFormatter.format(d)
            const dayNum = d.getDay().toString()
            const dayName = dayMap[d.getDay()]
            
            // Skip if it's not a work day (support both name and number)
            if (!workDays.includes(dayName) && !workDays.includes(dayNum)) continue

            // Skip if it's a holiday
            if (holidaySet.has(dateStr)) continue
            
            // Skip if they already have attendance or leave
            if (attendanceDateMap.has(`${u.id}-${dateStr}`)) continue
            if (leaveDateMap.has(`${u.id}-${dateStr}`)) continue
            
            absentAttendances.push({
                id: `absent-${u.id}-${dateStr}`,
                userId: u.id,
                checkIn: new Date(d),
                checkOut: null,
                checkInPhoto: null,
                checkOutPhoto: null,
                status: 'ABSENT',
                notes: 'Tanpa Keterangan',
                location: null,
                checkOutLocation: null,
                user: u,
                isLeave: false,
                isVirtual: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                tenantId,
                geofenceStatus: null,
                geofenceDistance: null,
                geofenceSiteName: null,
                checkOutGeofenceStatus: null,
                checkOutGeofenceDistance: null,
                geofenceMeta: null
            } as MappedAttendance)
        }
    })

    // 4. Combine and Filter
    const filteredAttendances = allAttendances.filter(att => {
        const dateStr = new Date(att.checkIn).toISOString().split('T')[0]
        const isDuplicateOfLeave = leaveDateMap.has(`${att.userId}-${dateStr}`)
        const isAutoGeneratedFromLeave = att.notes?.includes('Auto-generated from Leave Request')
        
        return !isDuplicateOfLeave && !isAutoGeneratedFromLeave
    })

    const allCombined = [...filteredAttendances, ...leaveAttendances, ...absentAttendances].sort((a, b) => 
        new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime()
    )

    if (isExport) {
        const csvRows = [['No', 'Karyawan', 'Site', 'Departemen', 'Tanggal', 'Jam Masuk', 'Jam Pulang', 'Status', 'Keterangan']]
        allCombined.forEach((item: MappedAttendance, index) => {
            const checkInDate = new Date(item.checkIn)
            const checkOutDate = item.checkOut ? new Date(item.checkOut) : null
            const dateOptions: Intl.DateTimeFormatOptions = { timeZone: timezone, day: '2-digit', month: '2-digit', year: 'numeric' }
            const timeOptions: Intl.DateTimeFormatOptions = { timeZone: timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }

            let displayStatus = item.status as string
            if (item.status === 'SICK') displayStatus = 'SAKIT'
            else if (item.status === 'PERMIT') displayStatus = 'IZIN'
            else if (item.status === 'ALPHA' || item.status === 'ABSENT') {
                const checkInDate = new Date(item.checkIn)
                const isSystemGenerated = checkInDate.getHours() === 0 && checkInDate.getMinutes() === 0
                const isToday = checkInDate.toDateString() === new Date().toDateString()
                
                if (isSystemGenerated) {
                    displayStatus = 'TIDAK HADIR'
                } else if (!isToday) {
                    const checkInHour = checkInDate.getHours()
                    const checkInMinute = checkInDate.getMinutes()
                    const wasOnTime = checkInHour < 8 || (checkInHour === 8 && checkInMinute === 0)
                    displayStatus = wasOnTime ? 'Tepat Waktu dan tidak cekout' : 'Terlambat dan tidak cekout'
                } else {
                    displayStatus = 'BELUM CHECKOUT'
                }
            }
            else if (item.status === 'ON_TIME') displayStatus = 'TEPAT WAKTU'
            else if (item.status === 'LATE') displayStatus = 'TERLAMBAT'

            csvRows.push([
                (index + 1).toString(),
                item.user.name || '-',
                item.user.sites?.name || '-',
                item.user.departments?.name || '-',
                checkInDate.toLocaleDateString('id-ID', dateOptions),
                item.isLeave ? '-' : checkInDate.toLocaleTimeString('id-ID', timeOptions).replace(/\./g, ':'),
                (item.isLeave || !checkOutDate) ? '-' : checkOutDate.toLocaleTimeString('id-ID', timeOptions).replace(/\./g, ':'),
                displayStatus,
                item.notes || '-'
            ])
        })
        const sanitizeCSV = (value: string) => (typeof value === 'string' && /^[=+\-@]/.test(value)) ? `'${value}` : value
        const csvContent = csvRows.map(row => row.map(cell => `"${sanitizeCSV(cell)}"`).join(',')).join('\n')
        return new NextResponse(csvContent, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="absensi.csv"` } })
    }

    const paginatedData = allCombined.slice(skip, skip + limit)
    const summary = filteredAttendances.reduce((acc, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    leaveAttendances.forEach(item => {
        summary[item.status] = (summary[item.status] || 0) + 1
    })

    absentAttendances.forEach(item => {
        summary[item.status] = (summary[item.status] || 0) + 1
    })

    return apiPaginatedWithSummary(paginatedData, { page, limit, total: allCombined.length, summary })
})
