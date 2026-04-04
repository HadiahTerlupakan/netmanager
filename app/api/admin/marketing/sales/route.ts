import { prisma } from '@/modules/database'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'

export const GET = createHandler({ auth: true }, async (_req, _ctx) => {
    // Check permissions
    if (!(await hasPermission('sales:read'))) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat data sales')
    }

    try {
        const salesUsers = await prisma.user.findMany({
            where: {
                isSales: true,
                isActive: true
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                canvasingTarget: true,
                targetSchema: true,
                departments: {
                    select: { name: true }
                },
                sites: {
                    select: { code: true, name: true }
                }
            },
            orderBy: {
                name: 'asc'
            }
        })

        // Calculate Aggregate Stats and Individual Progress for Current Month
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

        const salesIds = salesUsers.map(u => u.id)

        // Fetch all relevant canvasing data once
        const canvasingData = await prisma.canvasing.groupBy({
            by: ['salesId', 'status'],
            where: {
                salesId: { in: salesIds },
                createdAt: {
                    gte: startOfMonth,
                    lte: endOfMonth
                }
            },
            _count: {
                _all: true
            }
        })

        // Map stats to users
        const usersWithStats = salesUsers.map(user => {
            const userStats = canvasingData.filter(d => d.salesId === user.id)
            const achieved = userStats.find(d => d.status === 'APPROVED')?._count._all || 0
            const pending = userStats.find(d => d.status === 'PENDING')?._count._all || 0

            return {
                ...user,
                stats: {
                    achieved,
                    pending
                }
            }
        })

        // Calculate Global Stats
        let totalAchieved = 0
        let totalPending = 0

        canvasingData.forEach(stat => {
            if (stat.status === 'APPROVED') totalAchieved += stat._count._all
            if (stat.status === 'PENDING') totalPending += stat._count._all
        })

        const totalTarget = salesUsers.reduce((sum, user) => sum + (user.canvasingTarget || 0), 0)

        return apiSuccess({
            users: usersWithStats,
            stats: {
                totalSales: salesUsers.length,
                totalTarget,
                totalAchieved,
                totalPending
            }
        })
    } catch (error) {
        console.error('Error fetching sales data:', error)
        return ApiErrors.internalError('Gagal mengambil data sales: ' + (error instanceof Error ? error.message : String(error)))
    }
})
