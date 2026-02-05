import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWorkOrderReminder } from '@/modules/work-order/services/WorkOrderNotifications'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

interface ReminderResult {
    workOrderId: string
    workOrderNumber: string
    status: string
    ageHours: number
    sentCount: number
}

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            console.log('[Cron WO Reminder] Unauthorized access attempt')
            return ApiErrors.unauthorized('Unauthorized')
        }

        const now = new Date()
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

        console.log(`[Cron WO Reminder] Starting auto-reminder check at ${now.toISOString()}`)

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
            take: 100,
        })

        console.log(`[Cron WO Reminder] Found ${staleWorkOrders.length} stale work orders`)

        const results: ReminderResult[] = []
        let totalSent = 0

        for (const wo of staleWorkOrders) {
            const ageHours = Math.floor((now.getTime() - wo.createdAt.getTime()) / (1000 * 60 * 60))
            
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

        return apiSuccess({
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
        return ApiErrors.internalError(message)
    }
}
