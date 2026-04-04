import { headers } from 'next/headers'
import type { RabStatus } from '@prisma/client'
import { prisma } from '@/modules/database'
import { apiSuccess, ApiErrors } from '@/lib/api-response'
import { getEnv } from '@/lib/env'

export const dynamic = 'force-dynamic'

const STATUS_PENJUALAN = 'PENJUALAN' as RabStatus
const STATUS_TARGET_TERCAPAI = 'TARGET_TERCAPAI' as RabStatus
const STATUS_SELESAI = 'SELESAI' as RabStatus

export async function POST(_request: Request) {
    try {
        const env = getEnv()
        const headersList = await headers()
        const authHeader = headersList.get('authorization')

        if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
            return ApiErrors.unauthorized('Tidak terautentikasi')
        }

        const result = await evaluateRabStatus()

        return apiSuccess({
            ...result,
            timestamp: new Date().toISOString()
        }, { message: 'Evaluasi status RAB otomatis berhasil dijalankan' })
    } catch (error: unknown) {
        console.error('[Cron RAB Status] Error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Gagal menjalankan evaluasi status RAB'
        return ApiErrors.internalError(errorMessage)
    }
}

async function evaluateRabStatus() {
    const now = new Date()

    // Ambil semua project yang berstatus PENJUALAN atau TARGET_TERCAPAI
    // Kita cek TARGET_TERCAPAI juga barangkali sudah waktunya SELESAI
    const activeProjects = await prisma.rabProject.findMany({
        where: {
            status: {
                in: [STATUS_PENJUALAN, STATUS_TARGET_TERCAPAI]
            }
        },
        include: {
            actualAchievements: {
                orderBy: {
                    createdAt: 'desc'
                },
                take: 1
            }
        }
    })

    let updatedToTargetTercapai = 0
    let updatedToSelesai = 0
    const updatedIds: string[] = []

    for (const project of activeProjects) {
        let newStatus: RabStatus = project.status

        // 1. Cek apakah kontrak sudah selesai (Durasi terlampaui)
        // investmentDurationMonths dihitung dari startDate
        if (project.startDate && project.investmentDurationMonths) {
            const endDate = new Date(project.startDate)
            endDate.setMonth(endDate.getMonth() + project.investmentDurationMonths)

            if (now >= endDate) {
                newStatus = STATUS_SELESAI
            }
        }

        // 2. Jika belum selesai dan status masih PENJUALAN, cek target pelanggan
        if (newStatus === STATUS_PENJUALAN && project.targetSubscribers) {
            const latestAchievement = project.actualAchievements?.[0]
            if (latestAchievement && latestAchievement.actualSubscribers >= project.targetSubscribers) {
                newStatus = STATUS_TARGET_TERCAPAI
            }
        }

        // Update database jika ada perubahan status
        if (newStatus !== project.status) {
            try {
                await prisma.rabProject.update({
                    where: { id: project.id },
                    data: {
                        status: newStatus,
                        updatedAt: new Date()
                    }
                })

                if (newStatus === STATUS_TARGET_TERCAPAI) updatedToTargetTercapai++
                if (newStatus === STATUS_SELESAI) updatedToSelesai++
                updatedIds.push(project.id)
                console.log(`[Cron RAB Status] Project ${project.name} (${project.id}) status diubah ke ${newStatus}`)
            } catch (error) {
                console.error(`[Cron RAB Status] Gagal mengupdate project ${project.id}:`, error)
            }
        }
    }

    return {
        updatedToTargetTercapai,
        updatedToSelesai,
        updatedProjectIds: updatedIds,
        checkedDate: now.toISOString().split('T')[0]
    }
}

export async function GET(_request: Request) {
    return POST(_request)
}
