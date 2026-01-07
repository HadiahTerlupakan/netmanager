import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { AttendanceService } from '@/modules/attendance/services/AttendanceService'
import { OvertimeService } from '@/modules/overtime/services/OvertimeService'

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
        const user = session.user as any
        const isSuperAdmin = user.role === 'SUPER_ADMIN'

        if (user.permissions?.includes('attendance:site_only') && !isSuperAdmin) {
            siteId = user.siteId
        }
        if (user.permissions?.includes('attendance:department_only') && !isSuperAdmin) {
            departmentId = user.departmentId
        }

        if (!startDateStr || !endDateStr) {
            return NextResponse.json({ error: 'Start date and End date required' }, { status: 400 })
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

        return NextResponse.json({
            success: true,
            data: {
                attendance: attendanceReport,
                overtime: overtimeReport
            }
        })

    } catch (error: any) {
        console.error('Error fetching reports:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
