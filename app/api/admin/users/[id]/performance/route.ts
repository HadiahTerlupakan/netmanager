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

    // 1. Attendance Stats (Last 30 Days)
    const thirtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 30))
    
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
      total: 0
    }

    attendanceStats.forEach(stat => {
      const status = stat.status.toUpperCase() // Ensure case consistency
      if (status === 'PRESENT' || status === 'ON_TIME') attendance.present += stat._count._all
      else if (status === 'LATE' || status === 'TERLAMBAT') attendance.late += stat._count._all
      else if (status === 'ABSENT' || status === 'ALPHA') attendance.absent += stat._count._all 
    })
    attendance.total = attendance.present + attendance.late + attendance.absent

    // 2. Leave Request Stats (All Time - Approved Only)
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

    // 3. Work Order Stats (All Time)
    const workOrderStats = await prisma.workOrders.aggregate({
      where: {
        assignedToId: userId, // Assuming direct assignment
        // If using WorkOrderAssignments table, logic would differ. Checking schema...
        // Schema has `assignedToId` on WorkOrder Table AND `WorkOrderAssignments` table.
        // Usually `assignedToId` is the primary assignee. I'll filter by that for simplicity for now.
      },
      _count: {
        id: true, // Total Assigned
      },
      _avg: {
        rating: true // Avg Rating
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

    // 4. Return Aggregated Data
    return NextResponse.json({
      data: {
        attendance,
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
