import { NextRequest } from 'next/server'
import { verifyAuth, getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { apiSuccess, ApiErrors } from '@/lib/api-response'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    const session = await verifyAuth(req)
    if (!session) {
        return ApiErrors.unauthorized('Session tidak valid')
    }

    try {
        const permissions = await getUserPermissions(session.id);
        const isSuper = isSuperAdmin(session)

        // Site filter logic - inherit from gudang/barang restrictions
        const hasRestriction = permissions.includes('barang:site_only') ||
                               permissions.includes('k_barang:site_only') ||
                               permissions.includes('gudang:site_only')

        const siteId = (!isSuper && hasRestriction) ? session.siteId : undefined

        // Build filters
        const gudangFilter: Prisma.GudangWhereInput = { isActive: true }
        const transactionFilter: Prisma.BarangMasukWhereInput = {}

        if (siteId) {
            const siteRelation = { sites: { some: { id: siteId } } }

            // Filter gudang by site
            gudangFilter.sites = { some: { id: siteId } }

            // Filter transactions by gudang's site
            transactionFilter.gudang = siteRelation
        }

        // Date filter for "Today"
        const startOfDay = new Date()
        startOfDay.setHours(0, 0, 0, 0)

        // Add date filter to transaction filters
        const todayFilter: Prisma.BarangMasukWhereInput = {
            ...transactionFilter,
            createdAt: { gte: startOfDay }
        }

        const [
            totalBarang,
            barangMasukToday,
            barangKeluarToday,
            totalGudang
        ] = await Promise.all([
            prisma.barang.count(), // Total Master Barang (Global)
            prisma.barangMasuk.count({ where: todayFilter }),
            prisma.barangKeluar.count({ where: todayFilter as unknown as Prisma.BarangKeluarWhereInput }),
            prisma.gudang.count({ where: gudangFilter })
        ])

        return apiSuccess({
            totalBarang,
            barangMasukToday,
            barangKeluarToday,
            totalGudang
        })

    } catch (error) {
        const err = error as Error
        logger.error('Error fetching inventory stats:', err)
        return ApiErrors.internalError('Gagal memuat statistik inventori')
    }
}
