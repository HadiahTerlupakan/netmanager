import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AbsenceService } from '@/modules/attendance/services/AbsenceService'
export async function GET(request: Request) {
    const url = new URL(request.url)
    const authHeader = request.headers.get('authorization')
    const tokenParam = url.searchParams.get('cron_secret') || url.searchParams.get('token')

    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
        return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
    }

    if (authHeader !== `Bearer ${cronSecret}` && tokenParam !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const dateParam = url.searchParams.get('date')
        const targetDate = dateParam ? new Date(dateParam) : new Date()

        if (!dateParam) {
            targetDate.setDate(targetDate.getDate() - 1)
        }

        const tenants = await prisma.tenant.findMany({
            where: { isActive: true },
            select: { id: true }
        })

        const absenceService = new AbsenceService()
        let totalGenerated = 0
        const resultLog: string[] = []

        for (const tenant of tenants) {
            try {
                const result = await absenceService.processDailyAbsence(targetDate, tenant.id)
                totalGenerated += result.absent
                resultLog.push(`Processed Tenant ${tenant.id}: generated ${result.absent} ABSENT records`)
            } catch (err) {
                console.error(`Error processing tenant ${tenant.id}:`, err)
                resultLog.push(`Error processing tenant ${tenant.id}: ${err instanceof Error ? err.message : String(err)}`)
            }
        }

        return NextResponse.json({
            success: true,
            message: `Cron job completed for ${targetDate.toISOString()}`,
            totalGenerated,
            log: resultLog
        })
    } catch (error) {
        console.error('Attendance Cron Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
