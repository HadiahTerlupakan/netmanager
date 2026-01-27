import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWorkOrderReminder } from '@/modules/work-order/services/WorkOrderNotifications'

/**
 * Cron Job: Auto-Reminder untuk Work Order yang Belum Dikerjakan > 1 Hari
 * 
 * Logic:
 * 1. Cari WO dengan status PENDING, ASSIGNED, atau IN_PROGRESS
 * 2. Filter WO yang sudah lebih dari 1 hari (24 jam) sejak dibuat/di-assign
 * 3. Kirim reminder ke teknisi yang relevan
 * 
 * Usage:
 * GET /api/cron/workorder-reminder
 * 
 * Security: Requires CRON_SECRET in Authorization header
 * Recommended cron schedule: Once daily (e.g. "0 8 * * *" = 08:00 setiap hari)
 */

interface ReminderResult {
    workOrderId: string
    workOrderNumber: string
    status: string
    ageHours: number
    sentCount: number
}

export async function GET(request: NextRequest) {
    try {
        // Verify cron secret in production
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        if (cronSecret) {
            if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
                console.log('[Cron WO Reminder] Unauthorized access attempt')
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            }
        } else {
            console.warn('[Cron WO Reminder] CRON_SECRET not set - endpoint is unprotected!')
        }

        const now = new Date()
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

        console.log(`[Cron WO Reminder] Starting auto-reminder check at ${now.toISOString()}`)
        console.log(`[Cron WO Reminder] Looking for WO older than ${oneDayAgo.toISOString()}`)

        // Find pending/assigned/in_progress WOs older than 1 day
        const staleWorkOrders = await prisma.workOrders.findMany({
            where: {
                status: { in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS'] },
                createdAt: { lte: oneDayAgo },
            },
            select: {
                id: true,
                workOrderNumber: true,
                title: true,
                type: true,
                priority: true,
                status: true,
                departmentId: true,
                siteId: true,
                assignedToId: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
            take: 100, // Limit to prevent overwhelming
        })

        console.log(`[Cron WO Reminder] Found ${staleWorkOrders.length} stale work orders`)

        const results: ReminderResult[] = []
        let totalSent = 0

        for (const wo of staleWorkOrders) {
            const ageHours = Math.floor((now.getTime() - wo.createdAt.getTime()) / (1000 * 60 * 60))
            
            // Build custom message berdasarkan status
            let customMessage: string
            if (wo.status === 'PENDING') {
                customMessage = `⏰ WO Menunggu ${ageHours} jam! ${wo.workOrderNumber} - ${wo.title}`
            } else if (wo.status === 'ASSIGNED') {
                customMessage = `⏰ WO Belum Dikerjakan ${ageHours} jam! ${wo.workOrderNumber} - ${wo.title}`
            } else {
                customMessage = `⏰ WO Sedang Proses ${ageHours} jam! ${wo.workOrderNumber} - ${wo.title}`
            }

            try {
                const sentCount = await sendWorkOrderReminder(
                    {
                        id: wo.id,
                        workOrderNumber: wo.workOrderNumber,
                        title: wo.title,
                        type: wo.type,
                        priority: wo.priority,
                        departmentId: wo.departmentId,
                        siteId: wo.siteId,
                        assignedToId: wo.assignedToId,
                    },
                    customMessage
                )

                results.push({
                    workOrderId: wo.id,
                    workOrderNumber: wo.workOrderNumber,
                    status: wo.status,
                    ageHours,
                    sentCount,
                })

                totalSent += sentCount
                console.log(`[Cron WO Reminder] Sent reminder for ${wo.workOrderNumber} (${ageHours}h old) → ${sentCount} recipients`)
            } catch (error) {
                console.error(`[Cron WO Reminder] Error sending reminder for ${wo.workOrderNumber}:`, error)
            }
        }

        return NextResponse.json({
            success: true,
            timestamp: now.toISOString(),
            summary: {
                staleWorkOrders: staleWorkOrders.length,
                totalRemindersSent: totalSent,
            },
            details: results,
        })

    } catch (error: unknown) {
        console.error('[Cron WO Reminder] Error:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
