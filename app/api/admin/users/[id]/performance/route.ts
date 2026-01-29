import { NextRequest } from 'next/server'
import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

/**
 * @swagger
 * /api/admin/users/{id}/performance:
 *   get:
 *     summary: Get user performance stats
 *     description: Mengambil statistik performa user (kehadiran, cuti, work order).
 *     tags: [Users]
 */
export const GET = createHandler({
  auth: true
}, async (req, ctx) => {
  const startTime = Date.now()
  const { session, params, permissions } = ctx
  const { id: userId } = params
  
  if (!userId) return ApiErrors.badRequest('Invalid User ID')

  if (!session) return ApiErrors.unauthorized()

  // Authorization: Self OR users:read permission
  const isSelf = session.user.id === userId
  const hasReadPermission = permissions.includes('users:read') || permissions.includes('*')

  if (!isSelf && !hasReadPermission) {
    return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat performa user ini')
  }

  // 0. Get User Working Hour Mode & Target
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      workingHourMode: true,
      flexibleTargetHour: true
    }
  })

  if (!user) return ApiErrors.notFound('User')

  const workingHourMode = user.workingHourMode || 'FIXED'
  const flexibleTargetHour = user.flexibleTargetHour || 8

  // 1. Attendance Stats (Last 30 Days)
  const thirtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 30))
  
  // Get start of current month for FLEXIBLE stats
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  
  // Group by status for last 30 days
  const attendanceStats = await prisma.attendance.groupBy({
    by: ['status'],
    where: {
      userId: userId,
      checkIn: {
        gte: thirtyDaysAgo
      }
    },
    _count: {
      _all: true
    }
  })

  // Format Attendance Data
  const attendance = {
    present: 0,
    late: 0,
    absent: 0,
    alpha: 0,
    total: 0
  }

  attendanceStats.forEach(stat => {
    const status = stat.status
    const count = (stat._count as any)._all || 0
    if (status === 'ON_TIME') attendance.present += count
    else if (status === 'LATE') attendance.late += count
    else if (status === 'ABSENT' || status === 'DAY_OFF') attendance.absent += count
    else if (status === 'ALPHA') attendance.alpha += count
  })
  attendance.total = attendance.present + attendance.late + attendance.absent + attendance.alpha

  // 2. FLEXIBLE Stats: Calculate total working hours for current month
  let flexibleStats = {
    totalMinutesThisMonth: 0,
    totalHoursThisMonth: 0,
    daysWorkedThisMonth: 0,
    avgHoursPerDay: 0,
    targetHoursPerDay: flexibleTargetHour,
    targetPercentage: 0
  }

  if (workingHourMode === 'FLEXIBLE') {
    const monthlyAttendance = await prisma.attendance.findMany({
      where: {
        userId: userId,
        checkIn: { gte: startOfMonth },
        checkOut: { not: null }
      },
      select: {
        checkIn: true,
        checkOut: true
      }
    })

    let totalMinutes = 0
    monthlyAttendance.forEach(att => {
      if (att.checkOut) {
        const duration = (att.checkOut.getTime() - att.checkIn.getTime()) / (1000 * 60)
        totalMinutes += duration
      }
    })

    const daysWorked = monthlyAttendance.length
    const avgMinutesPerDay = daysWorked > 0 ? totalMinutes / daysWorked : 0
    const avgHoursPerDay = avgMinutesPerDay / 60

    // Calculate target percentage (based on avg hours vs target)
    const targetPercentage = flexibleTargetHour > 0 
      ? Math.round((avgHoursPerDay / flexibleTargetHour) * 100)
      : 0

    flexibleStats = {
      totalMinutesThisMonth: Math.round(totalMinutes),
      totalHoursThisMonth: Math.round(totalMinutes / 60 * 10) / 10,
      daysWorkedThisMonth: daysWorked,
      avgHoursPerDay: Math.round(avgHoursPerDay * 10) / 10,
      targetHoursPerDay: flexibleTargetHour,
      targetPercentage: Math.min(targetPercentage, 100) // Cap at 100%
    }
  }

  // 3. Leave Request Stats (All Time - Approved Only)
  const leaveStats = await prisma.leaveRequest.groupBy({
    by: ['type'],
    where: {
      userId: userId,
      status: 'APPROVED'
    },
    _count: {
      _all: true
    }
  })

  const leaves = {
    cuti: 0,
    sakit: 0,
    izin: 0,
    lainnya: 0,
    tukarLibur: 0,
    total: 0
  }

  leaveStats.forEach(stat => {
      const count = (stat._count as any)._all || 0
      leaves.total += count;
      if (stat.type === 'CUTI') leaves.cuti = count;
      else if (stat.type === 'SAKIT') leaves.sakit = count;
      else if (stat.type === 'IZIN') leaves.izin = count;
      else if (stat.type === 'LAINNYA') leaves.lainnya = count;
      else if (stat.type === 'TUKAR_LIBUR') leaves.tukarLibur = count;
  })

  // 4. Work Order Stats (All Time)
  const workOrderStats = await prisma.workOrders.aggregate({
    where: {
      assignedToId: userId,
    },
    _count: {
      id: true,
    },
    _avg: {
      rating: true
    }
  })

  const completedWorkOrders = await prisma.workOrders.count({
      where: {
          assignedToId: userId,
          status: 'COMPLETED'
      }
  })
  
  const activeWorkOrders = await prisma.workOrders.count({
      where: {
          assignedToId: userId,
          status: {
              in: ['PENDING', 'IN_PROGRESS', 'ON_HOLD']
          }
      }
  })

  const workOrders = {
    totalAssigned: workOrderStats._count?.id || 0,
    completed: completedWorkOrders,
    active: activeWorkOrders,
    completionRate: (workOrderStats._count?.id || 0) > 0 
      ? Math.round((completedWorkOrders / (workOrderStats._count?.id || 1)) * 100) 
      : 0,
    avgRating: workOrderStats._avg?.rating ? Number(workOrderStats._avg.rating.toFixed(1)) : 0
  }

  logger.apiRequest('GET', `/api/admin/users/${userId}/performance`, 200, Date.now() - startTime, {
    userId: session.user.id,
    targetUserId: userId
  })

  return apiSuccess({
    workingHourMode,
    attendance,
    flexibleStats,
    leaves,
    workOrders
  })
})
