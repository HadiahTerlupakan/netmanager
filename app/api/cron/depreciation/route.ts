import { NextRequest } from 'next/server'
import { AssetService } from '@/modules/inventory/services/AssetService'
import { prisma } from '@/lib/prisma'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

const assetService = new AssetService()

export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization')
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return ApiErrors.unauthorized('Cron secret tidak valid')
        }

        let systemUser = await prisma.user.findFirst({
            where: { role: { name: 'SUPER_ADMIN' } }
        })

        if (!systemUser) {
            systemUser = await prisma.user.findFirst()
        }

        if (!systemUser) {
            return ApiErrors.internalError('No user found to execute cron job (System requires at least one user)')
        }
        
        const results = await assetService.runMonthlyDepreciationCycle(systemUser.id)

        return apiSuccess({ 
            processed: results.length,
        }, { message: `Depreciation run completed. Processed ${results.length} assets.` })
    } catch (error: any) {
        console.error('Depreciation Cron Failed:', error)
        return ApiErrors.internalError(error.message || 'Depreciation cron failed')
    }
}
