import { NextRequest } from 'next/server'
import { 
    processCheckInReminders, 
    processCheckOutReminders, 
    processIncompleteAttendance,
    runScheduledAttendanceCheck 
} from '@/modules/attendance/services/AttendanceAlertService'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            // console.log('[Cron] Unauthorized access attempt')
            return ApiErrors.unauthorized('Tidak terautentikasi')
        }

        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type') || 'auto'

        let result: Record<string, unknown> | undefined;

        switch (type) {
            case 'checkin':
                result = await processCheckInReminders()
                return apiSuccess({
                    type: 'checkin_reminder',
                    ...result
                })

            case 'checkout':
                result = await processCheckOutReminders()
                return apiSuccess({
                    type: 'checkout_reminder',
                    ...result
                })

            case 'process':
                result = await processIncompleteAttendance()
                return apiSuccess({
                    type: 'process_incomplete',
                    ...result
                })

            case 'auto':
            default:
                result = await runScheduledAttendanceCheck()
                return apiSuccess({
                    type: 'auto_scheduled',
                    timestamp: new Date().toISOString(),
                    ...result
                })
        }
    } catch (error: unknown) {
        console.error('[Cron] Attendance alert error:', error)
        const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
        return ApiErrors.internalError(message)
    }
}
