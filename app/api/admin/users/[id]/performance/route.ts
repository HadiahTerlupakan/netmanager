import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    // Verify Admin Access
    if (!session?.user?.id) {
      console.log('Performance API: No session or user ID')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const userId = id

    // Allow ADMIN, SUPER_ADMIN, BRANCH_MANAGER, and MANAGER to view anyone
    // OR allow anyone to view THEIR OWN performance
    const userRole = session.user.role || ''
    const allowedRoles = ['ADMIN', 'SUPER_ADMIN', 'BRANCH_MANAGER', 'MANAGER', 'Branch Manager']
    
    // Check permissions
    const isSelf = session.user.id === userId
    const isAdmin = allowedRoles.includes(userRole)

    if (!isSelf && !isAdmin) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 0. Get User Working Hour Mode & Target
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        workingHourMode: true,
        flexibleTargetHour: true
      }
    })

    const workingHourMode = user?.workingHourMode || 'FIXED'
    const flexibleTargetHour = user?.flexibleTargetHour || 8

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
      if (status === 'ON_TIME') attendance.present += stat._count._all
      else if (status === 'LATE') attendance.late += stat._count._all
      else if (status === 'ABSENT' || status === 'DAY_OFF') attendance.absent += stat._count._all
      else if (status === 'ALPHA') attendance.alpha += stat._count._all
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
        const count = stat._count._all;
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
    
    // For pending/open tasks
    const activeWorkOrders = await prisma.workOrders.count({
        where: {
            assignedToId: userId,
            status: {
                in: ['PENDING', 'IN_PROGRESS', 'ON_HOLD']
            }
        }
    })

    const workOrders = {
      totalAssigned: workOrderStats._count.id,
      completed: completedWorkOrders,
      active: activeWorkOrders,
      completionRate: workOrderStats._count.id > 0 
        ? Math.round((completedWorkOrders / workOrderStats._count.id) * 100) 
        : 0,
      avgRating: workOrderStats._avg.rating ? Number(workOrderStats._avg.rating.toFixed(1)) : 0
    }

    // 5. Return Aggregated Data with workingHourMode
    return NextResponse.json({
      data: {
        workingHourMode,
        attendance,
        flexibleStats,
        leaves,
        workOrders
      }
    })

  } catch (error: any) {
    console.error('Error fetching user performance:', error)
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}
