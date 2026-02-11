import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { AbsenceService } from '@/modules/attendance/services/AbsenceService'
import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
    try {
        const headersList = await headers()
        const authHeader = headersList.get('authorization')

        if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
            return NextResponse.json(
                { success: false, error: 'Tidak terautentikasi' },
                { status: 401 }
            )
        }

        // Parse body to see if specific date is requested (for manual backfill)
        let targetDate = new Date()
        // Default: Process for YESTERDAY (H-1)
        targetDate.setDate(targetDate.getDate() - 1)

        try {
            const body = await request.json()
            if (body.date) {
                targetDate = new Date(body.date)
            }
        } catch (_e) {
            // No body or invalid json, use default
        }

        const absenceService = new AbsenceService()
        const result = await absenceService.processDailyAbsence(targetDate)

        return NextResponse.json({
            success: true,
            date: targetDate.toISOString().split('T')[0],
            result
        })

    } catch (error: unknown) {
        console.error('Error processing absence:', error)
        return NextResponse.json(
            { success: false, error: 'Terjadi kesalahan server' },
            { status: 500 }
        )
    }
}

export async function GET(request: Request) {
    return POST(request)
}
