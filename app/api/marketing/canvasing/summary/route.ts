import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await verifyAuth(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // RBAC Check & Filtering
    const isSuperAdmin = session.role === 'SUPER_ADMIN' || session.role === 'Super Admin'
    const permissions = await getUserPermissions(session.id)
    const canReadAll = isSuperAdmin || permissions.includes('canvasing:read')

    // Non-admins can only see their own data
    const salesIdFilter = canReadAll ? undefined : session.id

    // Get date ranges
    const now = new Date()
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
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

    return NextResponse.json({
      total,
      woStartedToday,
      completedToday,
      completedWeek,
      completedMonth,
      pending,
      approved,
      rejected
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
