import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateDaysRange } from '@/lib/validation-utils'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    const userId = session.user.id as string
    
    // Get date range from query params (default: last 30 days, max 365)
    const searchParams = request.nextUrl.searchParams
    const days = validateDaysRange(searchParams.get('days'), 365, 30)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const endDate = new Date()
    
    // Calculate individual stats
    const userAttendances = await prisma.attendance.findMany({
      where: {
        userId,
        checkIn: { gte: startDate, lte: endDate }
      },
      orderBy: { checkIn: 'desc' }
    })
    
    const stats = {
      totalDays: userAttendances.length,
      onTimeDays: userAttendances.filter(a => a.status === 'ON_TIME').length,
      lateDays: userAttendances.filter(a => a.status === 'LATE').length,
      avgWorkHours: 0,
      totalWorkHours: 0,
      onTimeRate: 0,
      lateRate: 0
    }
    
    // Calculate work hours
    let totalMinutes = 0
    userAttendances.forEach(att => {
      if (att.checkOut) {
        const diff = new Date(att.checkOut).getTime() - new Date(att.checkIn).getTime()
        totalMinutes += diff / (1000 * 60)
      }
    })
    
    stats.totalWorkHours = totalMinutes / 60
    stats.avgWorkHours = stats.totalDays > 0 ? stats.totalWorkHours / stats.totalDays : 0
    stats.onTimeRate = stats.totalDays > 0 ? (stats.onTimeDays / stats.totalDays) * 100 : 0
    stats.lateRate = stats.totalDays > 0 ? (stats.lateDays / stats.totalDays) * 100 : 0
    
    // Weekly breakdown
    const weeklyBreakdown = []
    for (let i = 0; i < 4; i++) {
      const weekStart = new Date(startDate)
      weekStart.setDate(weekStart.getDate() + (i * 7))
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)
      
      const weekAttendances = userAttendances.filter(a => {
        const checkIn = new Date(a.checkIn)
        return checkIn >= weekStart && checkIn < weekEnd
      })
      
      weeklyBreakdown.push({
        week: i + 1,
        startDate: weekStart,
        endDate: weekEnd,
        totalDays: weekAttendances.length,
        onTimeDays: weekAttendances.filter(a => a.status === 'ON_TIME').length,
        lateDays: weekAttendances.filter(a => a.status === 'LATE').length
      })
    }
    
    return NextResponse.json({
      success: true,
      data: {
        stats,
        weeklyBreakdown,
        recentAttendance: userAttendances.slice(0, 10),
        period: {
          startDate,
          endDate,
          days
        }
      }
    })
    
  } catch (error) {
    console.error('Error fetching attendance analytics:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
