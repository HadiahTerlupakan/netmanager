import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { AbsenceService } from '@/modules/attendance/services/AbsenceService'
import { acquireCronLock } from '@/lib/cron-lock'
import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'

function getDateLockKey(date: Date): string {
    return date.toISOString().slice(0, 10)
}

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

        const lockAcquired = await acquireCronLock(`processAbsence:${getDateLockKey(targetDate)}`, 60 * 60)
        if (!lockAcquired) {
            return NextResponse.json({
                success: true,
                skipped: true,
                reason: 'Lock already held'
            })
        }

        const absenceService = new AbsenceService()
        
        // Process for all active tenants
        const { prisma } = await import('@/lib/prisma')
        const tenants = await prisma.tenant.findMany({
            where: { isActive: true },
            select: { id: true }
        })

        const summaries = []
        for (const tenant of tenants) {
            try {
                const result = await absenceService.processDailyAbsence(targetDate, tenant.id)
                summaries.push({ tenantId: tenant.id, ...result })
            } catch (err) {
                console.error(`[Cron] Error for tenant ${tenant.id}:`, err)
            }
        }

        return NextResponse.json({
            success: true,
            date: targetDate.toISOString().split('T')[0],
            tenantsProcessed: summaries.length,
            results: summaries
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
