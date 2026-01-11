import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check permissions
        if (!(await hasPermission('sales:read'))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

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

        // Calculate Aggregate Stats for Current Month
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        
        const salesIds = salesUsers.map(u => u.id)

        const canvasingStats = await prisma.canvasing.groupBy({
            by: ['status'],
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

        let totalAchieved = 0
        let totalPending = 0

        canvasingStats.forEach(stat => {
            if (stat.status === 'APPROVED') totalAchieved += stat._count._all
            if (stat.status === 'PENDING') totalPending += stat._count._all
        })

        const totalTarget = salesUsers.reduce((sum, user) => sum + (user.canvasingTarget || 0), 0)

        // Return new structure
        return NextResponse.json({ 
            success: true, 
            data: {
                users: salesUsers,
                stats: {
                    totalSales: salesUsers.length,
                    totalTarget,
                    totalAchieved,
                    totalPending
                }
            } 
        })
    } catch (error: any) {
        console.error('Error fetching sales users:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
