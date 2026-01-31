import { prisma } from '@/lib/prisma'
import { createNotification } from '@/modules/notification/services/NotificationService'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

export async function POST(_request: Request) {
    try {
        // Security check (uncomment for production)
        // const headersList = await headers()
        // const authHeader = headersList.get('authorization')
        // if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        //     return ApiErrors.unauthorized('Cron secret tidak valid')
        // }

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
    const now = new Date()
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const tomorrowEnd = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59, 999)

    console.log(`[Cron Auto-Approve Leave] Checking TUKAR_LIBUR for ${tomorrow.toISOString().split('T')[0]}`)

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
            await prisma.leaveRequest.update({
                where: { id: request.id },
                data: {
                    status: 'APPROVED',
                    approvedBy: 'SYSTEM_AUTO',
                    updatedAt: new Date()
                }
            })

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

export async function GET(_request: Request) {
    return POST(_request)
}
