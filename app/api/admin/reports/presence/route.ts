import { withAuth, withAnyPermission, withErrorHandler, applyRBACRestrictions } from '@/lib/middleware'
import { AttendanceService } from '@/modules/attendance/services/AttendanceService'
import { OvertimeService } from '@/modules/overtime/services/OvertimeService'
import { apiSuccess, ErrorCodes, apiError } from '@/lib/api-response'

// Disable Next.js caching for this route
export const dynamic = 'force-dynamic'

export const GET = withErrorHandler(
    withAuth(
        withAnyPermission(['attendance:read', 'attendance:report:view'],
            applyRBACRestrictions(
                {
                    sitePermission: 'attendance:site_only',
                    departmentPermission: 'attendance:department_only'
                },
                async ({ filters }) => {
                    const { startDate: startDateStr, endDate: endDateStr, siteId, departmentId } = filters as Record<string, string>

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
                }
            )
        )
    )
)
