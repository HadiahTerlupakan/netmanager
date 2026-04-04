import { prisma } from '@/modules/database'
import { prismaMitra } from '@/modules/database'
import { ensurePermission } from '@/lib/rbac'
import { apiSuccess, createHandler } from '@/lib/api'

export const dynamic = 'force-dynamic'

export const GET = createHandler({ auth: true }, async (_req, _ctx) => {
    await ensurePermission('app_version:read')

    // Get latest active version
    const latestVersion = await prisma.appVersion.findFirst({
        where: { isActive: true },
        orderBy: { versionCode: 'desc' }
    })

    if (!latestVersion) {
        return apiSuccess({
            updatedCount: 0,
            outdatedCount: 0,
            unknownCount: 0,
            latestVersion: null
        })
    }

    const [updatedUsers, updatedCustomers, updatedMitra, outdatedUsers, outdatedCustomers, outdatedMitra, unknownUsers, unknownCustomers, unknownMitra] = await Promise.all([
        prisma.user.count({
            where: {
                isActive: true,
                lastVersionCode: { gte: latestVersion.versionCode }
            }
        }),
        prisma.pelanggan.count({
            where: {
                status: 'AKTIF',
                lastVersionCode: { gte: latestVersion.versionCode }
            }
        }),
        prismaMitra.mitra.count({
            where: {
                isActive: true,
                lastVersionCode: { gte: latestVersion.versionCode }
            }
        }),
        prisma.user.count({
            where: {
                isActive: true,
                lastVersionCode: { lt: latestVersion.versionCode }
            }
        }),
        prisma.pelanggan.count({
            where: {
                status: 'AKTIF',
                lastVersionCode: { lt: latestVersion.versionCode }
            }
        }),
        prismaMitra.mitra.count({
            where: {
                isActive: true,
                lastVersionCode: { lt: latestVersion.versionCode }
            }
        }),
        prisma.user.count({
            where: {
                isActive: true,
                lastVersionCode: null
            }
        }),
        prisma.pelanggan.count({
            where: {
                status: 'AKTIF',
                lastVersionCode: null
            }
        }),
        prismaMitra.mitra.count({
            where: {
                isActive: true,
                lastVersionCode: null
            }
        })
    ])

    const updatedCount = updatedUsers + updatedCustomers + updatedMitra
    const outdatedCount = outdatedUsers + outdatedCustomers + outdatedMitra
    const unknownCount = unknownUsers + unknownCustomers + unknownMitra

    return apiSuccess({
        updatedCount,
        outdatedCount,
        unknownCount,
        latestVersion: {
            version: latestVersion.version,
            versionCode: latestVersion.versionCode
        }
    })
})
