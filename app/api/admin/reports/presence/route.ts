import { AttendanceService } from '@/modules/attendance'
import { OvertimeService } from '@/modules/overtime'
import { apiSuccess, ErrorCodes, apiError, createHandler, ApiErrors } from '@/lib/api'
import { hasPermission } from '@/lib/rbac'
import { prisma } from '@/modules/database'
import { isSuperAdmin } from '@/lib/auth'
import { toStartOfDay, toEndOfDay } from '@/lib/utils/server-datetime'


// Disable Next.js caching for this route
export const dynamic = 'force-dynamic'

export const GET = createHandler({ auth: true }, async (req, ctx) => {
    // Check permission
    const hasRead = await hasPermission('attendance:read');
    const hasViewReport = await hasPermission('attendance:report:view');
    
    if (!hasRead && !hasViewReport) {
        return ApiErrors.forbidden('Akses ditolak');
    }

    const { searchParams } = req.nextUrl
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    
    // RBAC filtering params
    const user = ctx.session!.user
    const isSuper = isSuperAdmin(user)
    
    let siteId = searchParams.get('siteId')
    let departmentId = searchParams.get('departmentId')

    if (!isSuper) {
        // Fetch extended user info
        const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { siteId: true, departmentId: true }
        })

        const permissions = ctx.permissions || []
        
        if (permissions.includes('attendance:site_only')) {
            if (!dbUser?.siteId) return apiSuccess({ attendance: [], overtime: [] }) // No access if restricted but no site
            siteId = dbUser.siteId
        }
        
        if (permissions.includes('attendance:department_only')) {
            if (!dbUser?.departmentId) return apiSuccess({ attendance: [], overtime: [] })
            departmentId = dbUser.departmentId
        }
    }

    if (!startDateStr || !endDateStr) {
        return apiError('Tanggal mulai dan tanggal akhir wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    const startDate = new Date(startDateStr)
    startDate.setTime(toStartOfDay(startDate).getTime())
    const endDate = new Date(endDateStr)
    endDate.setTime(toEndOfDay(endDate).getTime())

    const attendanceService = new AttendanceService()
    const overtimeService = new OvertimeService()

    const [attendanceReport, overtimeReport] = await Promise.all([
        attendanceService.getReportData(startDate, endDate, siteId || undefined, departmentId || undefined),
        overtimeService.getReportData(startDate, endDate, siteId || undefined, departmentId || undefined)
    ])

    return apiSuccess({
        attendance: attendanceReport,
        overtime: overtimeReport
    })
})
