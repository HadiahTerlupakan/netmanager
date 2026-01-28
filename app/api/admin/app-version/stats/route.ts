import { prisma } from '@/lib/prisma'
import { ensurePermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
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

        // Count users
        const updatedCount = await prisma.user.count({
            where: {
                isActive: true,
                lastVersionCode: { gte: latestVersion.versionCode }
            }
        })

        const outdatedCount = await prisma.user.count({
            where: {
                isActive: true,
                lastVersionCode: { lt: latestVersion.versionCode }
            }
        })
        
        const unknownCount = await prisma.user.count({
            where: {
                isActive: true,
                lastVersionCode: null
            }
        })

        return apiSuccess({
            updatedCount,
            outdatedCount,
            unknownCount,
            latestVersion: {
                version: latestVersion.version,
                versionCode: latestVersion.versionCode
            }
        })

    } catch (error) {
        console.error('Error fetching app version stats:', error)
        return ApiErrors.internalError('Gagal mengambil statistik versi aplikasi')
    }
}
