import { ensureAnyPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { ProcurementIndexClient } from './ProcurementIndexClient'
import { startOfMonth, endOfMonth } from 'date-fns'

export default async function Page() {
    // Ensure user has access to at least one procurement feature
    await ensureAnyPermission(['purchase_order:read', 'market_price:read', 'procurement:read'])

    const now = new Date()
    const firstDayOfMonth = startOfMonth(now)
    const lastDayOfMonth = endOfMonth(now)

    // Parallel data fetching
    const [
        totalPOs, 
        draftPOs, 
        activePOs, 
        monthlySpending, 
        recentPOs
    ] = await Promise.all([
        // 1. Total PO Count
        prisma.purchaseOrder.count(),

        // 2. Draft/Pending POs
        prisma.purchaseOrder.count({
            where: { status: 'DRAFT' }
        }),

        // 3. Active/Ordered POs (not received yet)
        prisma.purchaseOrder.count({
            where: { 
                status: {
                    in: ['ORDERED', 'PARTIAL']
                }
            }
        }),

        // 4. Monthly Spending (Grand Total of Non-Cancelled POs created this month)
        // Note: Ideally should be based on 'issuedAt' or 'paymentDate', but createdAt is safer fallback
        prisma.purchaseOrder.aggregate({
            _sum: {
                grandTotal: true
            },
            where: {
                status: {
                    not: 'CANCELLED'
                },
                createdAt: {
                    gte: firstDayOfMonth,
                    lte: lastDayOfMonth
                }
            }
        }),

        // 5. Recent Purchase Orders
        prisma.purchaseOrder.findMany({
            take: 5,
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                supplier: {
                    select: {
                        name: true
                    }
                }
            }
        })
    ])

    const stats = {
        totalPOs,
        draftPOs,
        activePOs,
        monthlySpending: monthlySpending._sum.grandTotal || 0
    }

    // Serialize dates for client component
    const serializedRecentPOs = recentPOs.map(po => ({
        ...po,
        createdAt: po.createdAt.toISOString(),
        updatedAt: po.updatedAt.toISOString(),
        issuedAt: po.issuedAt ? po.issuedAt.toISOString() : null,
        expectedDate: po.expectedDate ? po.expectedDate.toISOString() : null,
    }))

    return <ProcurementIndexClient stats={stats} recentPOs={serializedRecentPOs} />
}
