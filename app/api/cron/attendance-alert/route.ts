import { NextRequest, NextResponse } from 'next/server'
import { 
    processCheckInReminders, 
    processCheckOutReminders, 
    processIncompleteAttendance,
    runScheduledAttendanceCheck 
} from '@/modules/attendance/services/AttendanceAlertService'

/**
 * API endpoint to trigger attendance alerts
 * Can be called by cron job services like Vercel Cron, Railway, or external services
 * 
 * Usage:
 * GET /api/cron/attendance-alert?type=auto      (recommended - auto-check based on site schedules)
 * GET /api/cron/attendance-alert?type=checkin   (force check-in reminders)
 * GET /api/cron/attendance-alert?type=checkout  (force check-out reminders)
 * GET /api/cron/attendance-alert?type=process   (process incomplete attendance)
 * 
 * Security: Requires CRON_SECRET in Authorization header
 * 
 * Recommended cron schedule: Every 15 minutes (e.g. "star/15 star star star star")
 */
export async function GET(request: NextRequest) {
    try {
        // Verify cron secret in production
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        if (cronSecret) {
            if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
                console.log('[Cron] Unauthorized access attempt')
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            }
        } else {
            console.warn('[Cron] CRON_SECRET not set - endpoint is unprotected!')
        }

        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type') || 'auto'

        let result: any

        switch (type) {
            case 'checkin':
                result = await processCheckInReminders()
                return NextResponse.json({
                    success: true,
                    type: 'checkin_reminder',
                    ...result
                })

            case 'checkout':
                result = await processCheckOutReminders()
                return NextResponse.json({
                    success: true,
                    type: 'checkout_reminder',
                    ...result
                })

            case 'process':
                result = await processIncompleteAttendance()
                return NextResponse.json({
                    success: true,
                    type: 'process_incomplete',
                    ...result
                })

            case 'auto':
            default:
                // Auto mode: Check all sites based on their configured schedules
                result = await runScheduledAttendanceCheck()
                return NextResponse.json({
                    success: true,
                    type: 'auto_scheduled',
                    timestamp: new Date().toISOString(),
                    ...result
                })
        }
    } catch (error: unknown) {
        console.error('[Cron] Attendance alert error:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
