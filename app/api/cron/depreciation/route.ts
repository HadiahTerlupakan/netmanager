import { NextRequest, NextResponse } from 'next/server'
import { AssetService } from '@/modules/inventory/services/AssetService'
import { prisma } from '@/lib/prisma'

const assetService = new AssetService()

export async function GET(req: NextRequest) {
    try {
        // Basic security check for Cron
        const authHeader = req.headers.get('authorization')
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Fetch a valid system user (Super Admin) to record these transactions
        let systemUser = await prisma.user.findFirst({
            where: { role: { name: 'SUPER_ADMIN' } }
        })

        if (!systemUser) {
            // Fallback to any user if no super admin
            systemUser = await prisma.user.findFirst()
        }

        if (!systemUser) {
            return NextResponse.json({ error: 'No user found to execute cron job (System requires at least one user)' }, { status: 500 })
        }
        
        const results = await assetService.runMonthlyDepreciationCycle(systemUser.id)

        return NextResponse.json({ 
            success: true, 
            processed: results.length,
            message: `Depreciation run completed. Processed ${results.length} assets.`
        })
    } catch (error: any) {
        console.error('Depreciation Cron Failed:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
