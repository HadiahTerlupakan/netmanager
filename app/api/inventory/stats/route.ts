import { NextRequest } from 'next/server'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    const session = await verifyAuth(req)
    if (!session) {
        return ApiErrors.unauthorized('Session tidak valid')
    }

    try {
        const permissions = await getUserPermissions(session.id);
        const isSuperAdmin = session.role === 'SUPER_ADMIN'
        
        // Site filter logic - inherit from gudang/barang restrictions
        const hasRestriction = permissions.includes('barang:site_only') || 
                               permissions.includes('k_barang:site_only') ||
                               permissions.includes('gudang:site_only')

        const siteId = (!isSuperAdmin && hasRestriction) ? session.siteId : undefined

        // Build filters
        const gudangFilter: any = { isActive: true }
        const transactionFilter: any = {}

        if (siteId) {
            const siteRelation = { sites: { some: { id: siteId } } }
            
            // Filter gudang by site
            gudangFilter.sites = { some: { id: siteId } }
            
            // Filter transactions by gudang's site
            transactionFilter.gudang = siteRelation
        }

        const [
            totalBarang,
            barangMasukToday,
            barangKeluarToday,
            totalGudang
        ] = await Promise.all([
            prisma.barang.count(), // Total Master Barang (Global)
            prisma.barangMasuk.count({ where: transactionFilter }),
            prisma.barangKeluar.count({ where: transactionFilter }),
            prisma.gudang.count({ where: gudangFilter })
        ])

        return apiSuccess({
            totalBarang,
            barangMasukToday,
            barangKeluarToday,
            totalGudang
        })

    } catch (error: any) {
        logger.error('Error fetching inventory stats:', error)
        return ApiErrors.internalError('Gagal memuat statistik inventori')
    }
}
