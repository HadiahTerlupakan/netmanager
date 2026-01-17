import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await requireAdmin(request)
    if (session instanceof NextResponse) return session
    const { id } = await params

    // Get period filter from query params
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month' // day, week, month, all

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

        // Calculate date range based on period
        const now = new Date()
        let startDate: Date
        
        switch (period) {
            case 'day':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
                break
            case 'week':
                startDate = new Date(now)
                startDate.setDate(startDate.getDate() - startDate.getDay() + 1) // Monday
                startDate.setHours(0, 0, 0, 0)
                break
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1)
                break
            case 'all':
            default:
                startDate = new Date(0) // Beginning of time
        }
        
        const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

        // 1. Canvasing Stats for the period
        const canvasingStats = await prisma.canvasing.groupBy({
            by: ['status'],
            where: {
                salesId: id,
                ...(period !== 'all' && {
                    createdAt: {
                        gte: startDate,
                        lte: endDate
                    }
                })
            },
            _count: {
                _all: true
            }
        })

        const canvasing = {
            approved: 0,
            rejected: 0,
            pending: 0,
            total: 0
        }

        canvasingStats.forEach(stat => {
            const count = stat._count._all
            canvasing.total += count
            if (stat.status === 'APPROVED') canvasing.approved = count
            else if (stat.status === 'REJECTED') canvasing.rejected = count
            else if (stat.status === 'PENDING') canvasing.pending = count
        })

        // 2. Point Claims Stats for the period
        const pointClaimStats = await prisma.pointClaim.groupBy({
            by: ['status'],
            where: {
                salesId: id,
                ...(period !== 'all' && {
                    createdAt: {
                        gte: startDate,
                        lte: endDate
                    }
                })
            },
            _count: { _all: true },
            _sum: { pointValue: true }
        })

        const points = {
            approved: 0,
            approvedValue: 0,
            rejected: 0,
            pending: 0,
            pendingValue: 0,
            total: 0,
            totalValue: 0
        }

        pointClaimStats.forEach(stat => {
            const count = stat._count._all
            const value = stat._sum?.pointValue || 0
            points.total += count
            points.totalValue += value
            if (stat.status === 'APPROVED') {
                points.approved = count
                points.approvedValue = value
            } else if (stat.status === 'REJECTED') {
                points.rejected = count
            } else if (stat.status === 'PENDING') {
                points.pending = count
                points.pendingValue = value
            }
        })

        // 3. Recent Activity (Last 5)
        const recentActivityRaw = await prisma.canvasing.findMany({
            where: { salesId: id },
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                nama: true,
                status: true,
                createdAt: true,
                alamat: true,
                pointClaims: {
                    select: {
                        status: true,
                        pointValue: true
                    }
                }
            }
        })

        const recentActivity = recentActivityRaw.map(activity => ({
            id: activity.id,
            pelangganName: activity.nama,
            status: activity.status,
            createdAt: activity.createdAt,
            address: activity.alamat,
            pointClaim: activity.pointClaims || null
        }))

        // 4. Total All Time
        const totalAllTime = await prisma.canvasing.count({
            where: { salesId: id }
        })

        const totalPointsAllTime = await prisma.pointClaim.aggregate({
            where: { salesId: id, status: 'APPROVED' },
            _sum: { pointValue: true }
        })

        return NextResponse.json({
            success: true,
            data: {
                user,
                period,
                target: user.canvasingTarget || 50,
                canvasing: {
                    ...canvasing,
                    progress: Math.round((canvasing.approved / (user.canvasingTarget || 50)) * 100)
                },
                points,
                totalAllTime,
                totalPointsAllTime: totalPointsAllTime._sum?.pointValue || 0,
                recentActivity
            }
        })

    } catch (error: any) {
        console.error('Error fetching sales performance:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
