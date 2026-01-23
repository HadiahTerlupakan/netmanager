import { NextResponse } from 'next/server'
import { AbsenceService } from '@/modules/attendance/services/AbsenceService'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
    try {
        const headersList = await headers()
        const authHeader = headersList.get('authorization')
        
        // Simple security check (CRON_SECRET env var or Bearer token)
        // For development/demo, we might allow it if it matches a secret
        // Assuming secure environment or local call. 
        // Ideally: if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) ...
        
        // Parse body to see if specific date is requested (for manual backfill)
        let targetDate = new Date()
        // Default: Process for YESTERDAY (H-1)
        targetDate.setDate(targetDate.getDate() - 1)

        try {
            const body = await request.json()
            if (body.date) {
                targetDate = new Date(body.date)
            }
        } catch (e) {
            // No body or invalid json, use default
        }

        const absenceService = new AbsenceService()
        const result = await absenceService.processDailyAbsence(targetDate)

        return NextResponse.json({
            success: true,
            date: targetDate.toISOString().split('T')[0],
            result
        })

    } catch (error: any) {
        console.error('Error processing absence:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}

export async function GET(request: Request) {
    return POST(request)
}
