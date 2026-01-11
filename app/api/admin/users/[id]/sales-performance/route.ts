import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await requireAdmin(request)
    if (session instanceof NextResponse) return session
    const { id } = await params

    try {
        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                canvasingTarget: true,
            }
        })

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Get limits (e.g. current month)
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

        // 1. Stats for this month
        const stats = await prisma.canvasing.groupBy({
            by: ['status'],
            where: {
                salesId: id,
                createdAt: {
                    gte: startOfMonth,
                    lte: endOfMonth
                }
            },
            _count: {
                _all: true
            }
        })

        // Transform to cleaner object
        const performance = {
            approved: 0,
            rejected: 0,
            pending: 0,
            total: 0
        }

        stats.forEach(stat => {
            const count = stat._count._all
            performance.total += count
            if (stat.status === 'APPROVED') performance.approved = count
            else if (stat.status === 'REJECTED') performance.rejected = count
            else if (stat.status === 'PENDING') performance.pending = count
        })

        // 2. Recent Activity (Last 5)
        const recentActivityRaw = await prisma.canvasing.findMany({
            where: { salesId: id },
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                nama: true,
                status: true,
                createdAt: true,
                alamat: true
            }
        })

        const recentActivity = recentActivityRaw.map(activity => ({
            id: activity.id,
            pelangganName: activity.nama,
            status: activity.status,
            createdAt: activity.createdAt,
            address: activity.alamat
        }))

        // 3. All Time Stats (Optional, maybe for total count)
        const totalAllTime = await prisma.canvasing.count({
            where: { salesId: id }
        })

        return NextResponse.json({
            success: true,
            data: {
                user,
                target: user.canvasingTarget || 50,
                currentMonth: {
                    ...performance,
                    progress: Math.round((performance.approved / (user.canvasingTarget || 50)) * 100)
                },
                totalAllTime,
                recentActivity
            }
        })

    } catch (error: any) {
        console.error('Error fetching sales performance:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
