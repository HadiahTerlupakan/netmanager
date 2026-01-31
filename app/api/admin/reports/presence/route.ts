import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { AttendanceService } from '@/modules/attendance/services/AttendanceService'
import { OvertimeService } from '@/modules/overtime/services/OvertimeService'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

// Disable Next.js caching for this route
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
    try {
        const session = await requireAdmin(request)
        if (session instanceof NextResponse) {
            return session
        }

        const { searchParams } = new URL(request.url)
        const startDateStr = searchParams.get('startDate')
        const endDateStr = searchParams.get('endDate')
        let siteId = searchParams.get('siteId') || undefined
        let departmentId = searchParams.get('departmentId') || undefined

        // NEW: Enforce RBAC Restrictions
        const user = session.user as {
            role?: string;
            permissions?: string[];
            siteId?: string;
            departmentId?: string;
        }
        const isSuperAdmin = user.role === 'SUPER_ADMIN'

        if (user.permissions?.includes('attendance:site_only') && !isSuperAdmin) {
            siteId = user.siteId
        }
        if (user.permissions?.includes('attendance:department_only') && !isSuperAdmin) {
            departmentId = user.departmentId
        }

        if (!startDateStr || !endDateStr) {
            return apiError('Tanggal mulai dan tanggal akhir wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        const startDate = new Date(startDateStr)
        startDate.setHours(0, 0, 0, 0)
        const endDate = new Date(endDateStr)
        endDate.setHours(23, 59, 59, 999)

        const attendanceService = new AttendanceService()
        const overtimeService = new OvertimeService()

        const [attendanceReport, overtimeReport] = await Promise.all([
            attendanceService.getReportData(startDate, endDate, siteId, departmentId),
            overtimeService.getReportData(startDate, endDate, siteId, departmentId)
        ])

        return apiSuccess({
            attendance: attendanceReport,
            overtime: overtimeReport
        })

    } catch (error) {
        console.error('Error fetching reports:', error instanceof Error ? error.message : error)
        return ApiErrors.internalError('Gagal mengambil laporan')
    }
}
