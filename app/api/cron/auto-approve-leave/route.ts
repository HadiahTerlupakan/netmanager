import { headers } from 'next/headers'
import { prisma } from '@/modules/database'
import { getLeaveService } from '@/modules/attendance'
import { apiSuccess, ApiErrors } from '@/lib/api-response'
import { getEnv } from '@/lib/env'

export const dynamic = 'force-dynamic'

export async function POST(_request: Request) {
    try {
        const env = getEnv()
        const headersList = await headers()
        const authHeader = headersList.get('authorization')

        if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
            return ApiErrors.unauthorized('Tidak terautentikasi')
        }

        const result = await autoApproveTukarLibur()

        return apiSuccess({
            ...result,
            timestamp: new Date().toISOString()
        }, { message: 'Auto-approve leave berhasil dijalankan' })
    } catch (error: unknown) {
        console.error('[Cron Auto-Approve Leave] Error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Gagal menjalankan auto-approve leave'
        return ApiErrors.internalError(errorMessage)
    }
}

async function autoApproveTukarLibur() {
    const leaveService = getLeaveService()
    const now = new Date()
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const tomorrowEnd = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59, 999)

    // console.log(`[Cron Auto-Approve Leave] Checking TUKAR_LIBUR for ${tomorrow.toISOString().split('T')[0]}`)

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

    // console.log(`[Cron Auto-Approve Leave] Found ${pendingRequests.length} pending TUKAR_LIBUR requests`)

    let approvedCount = 0
    const approvedIds: string[] = []

    for (const request of pendingRequests) {
        try {
            await leaveService.approveLeave(request.id, 'SYSTEM_AUTO', request.tenantId)

            approvedCount++
            approvedIds.push(request.id)
            // console.log(`[Cron Auto-Approve Leave] Auto-approved request ${request.id} for user ${request.user?.name}`)
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

export async function GET(_request: Request) {
    return POST(_request)
}
