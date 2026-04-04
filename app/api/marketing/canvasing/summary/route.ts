import { NextRequest } from 'next/server'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { isSuperAdminRole } from '@/lib/auth-helpers'
import { prisma } from '@/modules/database'
import { apiSuccess, ApiErrors } from '@/lib/api-response'
import { toStartOfDay } from '@/lib/utils/server-datetime'



export async function GET(req: NextRequest) {
  try {
    const session = await verifyAuth(req)
    if (!session) return ApiErrors.unauthorized('Tidak terautentikasi')

    // RBAC Check & Filtering
    const isSuperAdmin = isSuperAdminRole(session.role)

    const permissions = await getUserPermissions(session.id)
    const canReadAll = isSuperAdmin || permissions.includes('canvasing:read')

    // Non-admins can only see their own data
    const salesIdFilter = canReadAll ? undefined : session.id

    // Get date ranges
    const now = new Date()
    const today = new Date(now)
    today.setTime(toStartOfDay(today).getTime())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Week start (Monday)
    const weekStart = new Date(today)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
    
    // Month start
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // Build where clause
    const whereClause = salesIdFilter ? { salesId: salesIdFilter } : {}

    // Count total canvasing for the user
    const total = await prisma.canvasing.count({
      where: whereClause
    })

    // Count WO from canvasing that started today (IN_PROGRESS or higher)
    const woStartedToday = await prisma.canvasing.count({
      where: {
        ...whereClause,
        workOrderId: { not: null },
        workOrder: {
          status: { in: ['IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'VERIFIED', 'CLOSED'] },
          startedAt: { gte: today, lt: tomorrow }
        }
      }
    })

    // Completed statuses for WO
    const completedStatuses: ('COMPLETED' | 'VERIFIED' | 'CLOSED')[] = ['COMPLETED', 'VERIFIED', 'CLOSED']

    // Count canvasing completed TODAY (WO completed today)
    const completedToday = await prisma.canvasing.count({
      where: {
        ...whereClause,
        workOrderId: { not: null },
        workOrder: {
          status: { in: completedStatuses },
          completedAt: { gte: today, lt: tomorrow }
        }
      }
    })

    // Count canvasing completed THIS WEEK
    const completedWeek = await prisma.canvasing.count({
      where: {
        ...whereClause,
        workOrderId: { not: null },
        workOrder: {
          status: { in: completedStatuses },
          completedAt: { gte: weekStart, lt: tomorrow }
        }
      }
    })

    // Count canvasing completed THIS MONTH
    const completedMonth = await prisma.canvasing.count({
      where: {
        ...whereClause,
        workOrderId: { not: null },
        workOrder: {
          status: { in: completedStatuses },
          completedAt: { gte: monthStart, lt: tomorrow }
        }
      }
    })

    // Count by status
    const pending = await prisma.canvasing.count({
      where: { ...whereClause, status: 'PENDING' }
    })

    const approved = await prisma.canvasing.count({
      where: { ...whereClause, status: 'APPROVED' }
    })

    const rejected = await prisma.canvasing.count({
      where: { ...whereClause, status: 'REJECTED' }
    })

    return apiSuccess({
      total,
      woStartedToday,
      completedToday,
      completedWeek,
      completedMonth,
      pending,
      approved,
      rejected
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal mengambil ringkasan canvasing'
    return ApiErrors.internalError(message)
  }
}
