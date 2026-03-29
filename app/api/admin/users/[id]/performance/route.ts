import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { toStartOfDay } from '@/lib/utils/server-datetime'
import { Prisma } from '@prisma/client'


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

  // 0. Get Date Range from Query Params
  const { searchParams } = new URL(req.url)
  const dateFromParam = searchParams.get('dateFrom')
  const dateToParam = searchParams.get('dateTo')
  const period = searchParams.get('period') || 'month'

  let startDate: Date
  let endDate = new Date()

  if (dateFromParam && dateToParam) {
    startDate = new Date(dateFromParam)
    endDate = new Date(dateToParam)
    // Ensure endDate is end of day
    endDate.setHours(23, 59, 59, 999)
  } else if (period === 'month') {
    startDate = new Date()
    startDate.setDate(1)
    startDate.setTime(toStartOfDay(startDate).getTime())
  } else {
    // All time - use a very old date as start
    startDate = new Date(0)
  }

  // 1. Attendance Stats
  const attendanceStats = await prisma.attendance.groupBy({
    by: ['status'],
    where: {
      userId: userId,
      checkIn: {
        gte: startDate,
        lte: endDate
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
    const count = (stat._count as { _all: number })._all || 0
    if (status === 'ON_TIME') attendance.present += count
    else if (status === 'LATE') attendance.late += count
    else if (status === 'ABSENT' || status === 'DAY_OFF' || status === 'NO_CHECKOUT') attendance.absent += count
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
    const rangeAttendance = await prisma.attendance.findMany({
      where: {
        userId: userId,
        checkIn: { gte: startDate, lte: endDate },
        checkOut: { not: null }
      },
      select: {
        checkIn: true,
        checkOut: true
      }
    })

    let totalMinutes = 0
    rangeAttendance.forEach(att => {
      if (att.checkOut) {
        const duration = (att.checkOut.getTime() - att.checkIn.getTime()) / (1000 * 60)
        totalMinutes += duration
      }
    })

    const daysWorked = rangeAttendance.length
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

  // 3. Leave Request Stats (Approved Only)
  const leaveStats = await prisma.leaveRequest.groupBy({
    by: ['type'],
    where: {
      userId: userId,
      status: 'APPROVED',
      startDate: { gte: startDate, lte: endDate }
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
      const count = (stat._count as { _all: number })._all || 0
      leaves.total += count;
      if (stat.type === 'CUTI') leaves.cuti = count;
      else if (stat.type === 'SAKIT') leaves.sakit = count;
      else if (stat.type === 'IZIN') leaves.izin = count;
      else if (stat.type === 'LAINNYA') leaves.lainnya = count;
      else if (stat.type === 'TUKAR_LIBUR') leaves.tukarLibur = count;
  })

  // 4. Work Order Stats
  const dateFilter = { createdAt: { gte: startDate, lte: endDate } }

  // 4a. Stats as LEAD (assignedToId)
  const leadWhere = {
    assignedToId: userId,
    ...dateFilter
  }
  const leadTotal = await prisma.workOrders.count({ where: leadWhere })
  const leadCompleted = await prisma.workOrders.count({
    where: { ...leadWhere, status: { in: ['COMPLETED', 'VERIFIED', 'CLOSED'] } }
  })

  // 4b. Stats as SUPPORT (In assignments table but not assignedToId)
  const supportWhere = {
    assignedToId: { not: userId }, // Not the lead
    assignments: { some: { userId: userId } },
    ...dateFilter
  }
  const supportTotal = await prisma.workOrders.count({ where: supportWhere })
  const supportCompleted = await prisma.workOrders.count({
    where: { ...supportWhere, status: { in: ['COMPLETED', 'VERIFIED', 'CLOSED'] } }
  })

  // 4c. Overall Stats (Combined)
  const overallWhere: Prisma.WorkOrdersWhereInput = {
    OR: [
      { assignedToId: userId },
      { assignments: { some: { userId: userId } } }
    ],
    ...dateFilter
  }

  const overallRating = await prisma.workOrders.aggregate({
    where: overallWhere,
    _avg: { rating: true }
  })

  const workOrders = {
    totalAssigned: leadTotal + supportTotal,
    completed: leadCompleted + supportCompleted,
    lead: {
        total: leadTotal,
        completed: leadCompleted
    },
    support: {
        total: supportTotal,
        completed: supportCompleted
    },
    completionRate: (leadTotal + supportTotal) > 0 
      ? Math.round(((leadCompleted + supportCompleted) / (leadTotal + supportTotal)) * 100) 
      : 0,
    avgRating: overallRating._avg?.rating ? Number(overallRating._avg.rating.toFixed(1)) : 0
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
