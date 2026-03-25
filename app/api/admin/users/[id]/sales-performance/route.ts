import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { toStartOfDay } from '@/lib/utils/server-datetime'


/**
 * @swagger
 * /api/admin/users/{id}/sales-performance:
 *   get:
 *     summary: Get sales performance stats
 *     description: Mengambil statistik performa sales (canvasing, points).
 *     tags: [Users]
 */
export const GET = createHandler({
  auth: true
}, async (req, ctx) => {
  const startTime = Date.now()
  const { session, params, query, permissions } = ctx
  const { id: userId } = params
  
  if (!userId) return ApiErrors.badRequest('Invalid User ID')
  const period = (query.period as string) || 'month'

  if (!session) return ApiErrors.unauthorized()

  // Authorization: Self OR users:read permission
  const isSelf = session.user.id === userId
  const hasReadPermission = permissions.includes('users:read') || permissions.includes('*')

  if (!isSelf && !hasReadPermission) {
    return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat performa sales user ini')
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      canvasingTarget: true,
    }
  })

  if (!user) return ApiErrors.notFound('User')

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
      startDate.setTime(toStartOfDay(startDate).getTime())
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
      salesId: userId,
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
    const count = (stat._count as Record<string, unknown>)._all as number || 0
    canvasing.total += count
    if (stat.status === 'APPROVED') canvasing.approved = count
    else if (stat.status === 'REJECTED') canvasing.rejected = count
    else if (stat.status === 'PENDING') canvasing.pending = count
  })

  // 2. Point Claims Stats for the period
  const pointClaimStats = await prisma.pointClaim.groupBy({
    by: ['status'],
    where: {
      salesId: userId,
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
    const count = (stat._count as Record<string, unknown>)._all as number || 0
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
    where: { salesId: userId },
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
    pointClaim: (activity as Record<string, unknown>).pointClaims || null
  }))

  // 4. Total All Time
  const totalAllTime = await prisma.canvasing.count({
    where: { salesId: userId }
  })

  const totalPointsAllTime = await prisma.pointClaim.aggregate({
    where: { salesId: userId, status: 'APPROVED' },
    _sum: { pointValue: true }
  })

  logger.apiRequest('GET', `/api/admin/users/${userId}/sales-performance`, 200, Date.now() - startTime, {
    userId: session.user.id,
    targetUserId: userId,
    period
  })

  return apiSuccess({
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
  })
})
