import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { hasPermission } from '@/lib/rbac'
import { prisma } from '@/modules/database'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export async function GET(request: NextRequest) {
    const session = await requireAdmin(request)
    if (session instanceof NextResponse) return session

    // Check permission
    if (!(await hasPermission('sales_dashboard:read'))) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat sales dashboard')
    }

    // Get period and site from query params
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month'
    const siteId = searchParams.get('siteId') || null
    const customStart = searchParams.get('startDate')
    const customEnd = searchParams.get('endDate')

    try {
        // Fetch sites for filter dropdown
        const sites = await prisma.sites.findMany({
            where: { isActive: true },
            select: { id: true, code: true, name: true },
            orderBy: { code: 'asc' }
        })

        // Calculate date range
        const now = new Date()
        let startDate: Date
        let endDate: Date

        switch (period) {
            case 'day':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
                break
            case 'week':
                startDate = new Date(now)
                startDate.setDate(startDate.getDate() - startDate.getDay() + 1)
                startDate.setTime(toStartOfDay(startDate).getTime())
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
                break
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1)
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
                break
            case 'custom':
                if (customStart && customEnd) {
                    startDate = new Date(customStart)
                    startDate.setTime(toStartOfDay(startDate).getTime())
                    endDate = new Date(customEnd)
                    endDate.setTime(toEndOfDay(endDate).getTime())
                } else {
                    // Default to this month if custom dates not provided
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1)
                    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
                }
                break
            case 'all':
            default:
                startDate = new Date(0)
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
        }

        // 1. Get all sales users (optionally filtered by site)
        const salesUsers = await prisma.user.findMany({
            where: { 
                isSales: true, 
                isActive: true,
                ...(siteId && { siteId })
            },
            select: {
                id: true,
                name: true,
                email: true,
                canvasingTarget: true,
                sites: { select: { code: true, name: true } }
            },
            orderBy: { name: 'asc' }
        })

        // 2. Get stats for each user
        const leaderboardPromises = salesUsers.map(async (user) => {
            // Get canvasing stats
            const canvasingStats = await prisma.canvasing.groupBy({
                by: ['status'],
                where: {
                    salesId: user.id,
                    ...(period !== 'all' && {
                        createdAt: { gte: startDate, lte: endDate }
                    })
                },
                _count: { _all: true }
            })

            let approved = 0, pending = 0, rejected = 0, total = 0
            canvasingStats.forEach(stat => {
                const count = stat._count._all
                total += count
                if (stat.status === 'APPROVED') approved = count
                else if (stat.status === 'PENDING') pending = count
                else if (stat.status === 'REJECTED') rejected = count
            })

            // Get points
            const pointsResult = await prisma.pointClaim.aggregate({
                where: {
                    salesId: user.id,
                    status: 'APPROVED',
                    ...(period !== 'all' && {
                        createdAt: { gte: startDate, lte: endDate }
                    })
                },
                _sum: { pointValue: true }
            })
            const points = pointsResult._sum?.pointValue || 0

            const target = user.canvasingTarget || 50
            const progress = Math.round((approved / target) * 100)

            return {
                id: user.id,
                name: user.name || user.email,
                target,
                approved,
                pending,
                rejected,
                total,
                points,
                progress
            }
        })

        const leaderboard = await Promise.all(leaderboardPromises)

        // Sort by points (descending) for ranking
        leaderboard.sort((a, b) => b.points - a.points || b.approved - a.approved)

        // Add rank
        const rankedLeaderboard = leaderboard.map((user, index) => ({
            ...user,
            rank: index + 1
        }))

        // 3. Team overview stats
        const teamStats = {
            totalSales: salesUsers.length,
            totalCanvasing: leaderboard.reduce((sum, u) => sum + u.total, 0),
            totalApproved: leaderboard.reduce((sum, u) => sum + u.approved, 0),
            totalPending: leaderboard.reduce((sum, u) => sum + u.pending, 0),
            totalRejected: leaderboard.reduce((sum, u) => sum + u.rejected, 0),
            totalPoints: leaderboard.reduce((sum, u) => sum + u.points, 0),
            avgProgress: leaderboard.length > 0 
                ? Math.round(leaderboard.reduce((sum, u) => sum + u.progress, 0) / leaderboard.length)
                : 0
        }

        // 4. Top performers (top 3)
        const topPerformers = rankedLeaderboard.slice(0, 3)

        // 5. Top sites (aggregated canvasing by site)
        const siteStats = await prisma.canvasing.groupBy({
            by: ['salesId'],
            where: {
                status: 'APPROVED',
                ...(period !== 'all' && {
                    createdAt: { gte: startDate, lte: endDate }
                })
            },
            _count: { _all: true }
        })

        // Map sales to their sites and aggregate
        const siteAggregation: Record<string, { id: string; code: string; name: string; approved: number; salesCount: number }> = {}
        
        for (const stat of siteStats) {
            const user = salesUsers.find(u => u.id === stat.salesId)
            if (user?.sites) {
                const site = user.sites
                if (!siteAggregation[site.code]) {
                    // Get site id from sites list
                    const fullSite = sites.find(s => s.code === site.code)
                    siteAggregation[site.code] = {
                        id: fullSite?.id || '',
                        code: site.code,
                        name: site.name,
                        approved: 0,
                        salesCount: 0
                    }
                }
                
                const siteEntry = siteAggregation[site.code]
                if (siteEntry) {
                    siteEntry.approved += stat._count._all
                }
            }
        }

        // Count sales per site
        for (const user of salesUsers) {
            if (user.sites) {
                const entry = siteAggregation[user.sites.code]
                if (entry) {
                    entry.salesCount++
                }
            }
        }

        const topSites = Object.values(siteAggregation)
            .sort((a, b) => b.approved - a.approved)
            .slice(0, 3)

        // 6. Weekly trend (last 7 days) for chart
        const weeklyTrend = []
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now)
            date.setDate(date.getDate() - i)
            date.setTime(toStartOfDay(date).getTime())
            
            const nextDate = new Date(date)
            nextDate.setDate(nextDate.getDate() + 1)

            const count = await prisma.canvasing.count({
                where: {
                    status: 'APPROVED',
                    createdAt: {
                        gte: date,
                        lt: nextDate
                    }
                }
            })

            weeklyTrend.push({
                date: date.toISOString().split('T')[0],
                day: date.toLocaleDateString('id-ID', { weekday: 'short' }),
                count
            })
        }

        return apiSuccess({
            period,
            siteId,
            sites,
            teamStats,
            topPerformers,
            topSites,
            leaderboard: rankedLeaderboard,
            weeklyTrend
        })

    } catch (error: unknown) {
        console.error('Error fetching sales dashboard:', error)
        return ApiErrors.internalError('Gagal mengambil data sales dashboard')
    }
}
import { NextResponse } from 'next/server'
import { toStartOfDay, toEndOfDay } from '@/lib/utils/server-datetime'

