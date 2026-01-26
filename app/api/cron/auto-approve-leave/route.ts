import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/modules/notification/services/NotificationService'

export const dynamic = 'force-dynamic'

/**
 * Auto-Approve Pending TUKAR_LIBUR Leave Requests
 * 
 * This cron job runs daily (e.g., at 23:00) to auto-approve any PENDING 
 * TUKAR_LIBUR requests where startDate is tomorrow (H-1).
 * 
 * This ensures employees who request TUKAR_LIBUR get their leave approved
 * automatically if admin doesn't take action before the leave date.
 * 
 * The approval is marked as "SYSTEM" to distinguish from manual admin approval.
 */

export async function POST(request: Request) {
    try {
        const headersList = await headers()
        const authHeader = headersList.get('authorization')
        
        // Security check can be enabled in production
        // if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        //     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        // }

        const result = await autoApproveTukarLibur()

        return NextResponse.json({
            success: true,
            ...result,
            timestamp: new Date().toISOString()
        })
    } catch (error: any) {
        console.error('[Cron Auto-Approve Leave] Error:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}

async function autoApproveTukarLibur() {
    // Get tomorrow's date range
    const now = new Date()
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const tomorrowEnd = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59, 999)

    console.log(`[Cron Auto-Approve Leave] Checking TUKAR_LIBUR for ${tomorrow.toISOString().split('T')[0]}`)

    // Find PENDING TUKAR_LIBUR requests with startDate = tomorrow
    const pendingRequests = await prisma.leaveRequest.findMany({
        where: {
            type: 'TUKAR_LIBUR',
            status: 'PENDING',
            startDate: {
                gte: tomorrow,
                lte: tomorrowEnd
            }
        },
        include: {
            user: {
                select: { id: true, name: true }
            }
        }
    })

    console.log(`[Cron Auto-Approve Leave] Found ${pendingRequests.length} pending TUKAR_LIBUR requests`)

    let approvedCount = 0
    const approvedIds: string[] = []

    for (const request of pendingRequests) {
        try {
            // Auto-approve with SYSTEM marker
            await prisma.leaveRequest.update({
                where: { id: request.id },
                data: {
                    status: 'APPROVED',
                    approvedBy: 'SYSTEM_AUTO', // Mark as system auto-approval
                    updatedAt: new Date()
                }
            })

            // Notify user about auto-approval
            await createNotification({
                type: 'SYSTEM',
                priority: 'NORMAL',
                title: '✅ Tukar Libur Disetujui Otomatis',
                message: `Pengajuan tukar libur Anda untuk tanggal ${request.startDate.toLocaleDateString('id-ID')} telah disetujui otomatis oleh sistem.`,
                userId: request.userId,
                sourceType: 'LEAVE',
                sourceId: request.id
            })

            approvedCount++
            approvedIds.push(request.id)
            console.log(`[Cron Auto-Approve Leave] Auto-approved request ${request.id} for user ${request.user?.name}`)
        } catch (error) {
            console.error(`[Cron Auto-Approve Leave] Failed to approve request ${request.id}:`, error)
        }
    }

    return {
        approvedCount,
        approvedIds,
        checkedDate: tomorrow.toISOString().split('T')[0]
    }
}

export async function GET(request: Request) {
    // Allow GET for easy testing via browser/curl
    return POST(request)
}
