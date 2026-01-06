import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    const session = await verifyAuth(req)
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const [
            totalBarang,
            totalStokResult,
            lowStockAlerts,
            totalGudang
        ] = await Promise.all([
            prisma.barang.count(),
            prisma.barangMasuk.count(),
            prisma.barangKeluar.count(),
            prisma.gudang.count({
                where: {
                    isActive: true
                }
            })
        ])

        return NextResponse.json({
            success: true,
            data: {
                totalBarang,
                barangMasukToday: totalStokResult, 
                barangKeluarToday: lowStockAlerts,
                totalGudang
            }
        })

    } catch (error: any) {
        logger.error('Error fetching inventory stats:', error)
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        )
    }
}
