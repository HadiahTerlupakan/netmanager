import { NextRequest, NextResponse } from 'next/server'
import { verifyMobileToken } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
    try {
        // 1. Verify Token
        const authHeader = req.headers.get('authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const token = authHeader.split(' ')[1]
        const payload = await verifyMobileToken(token)

        if (!payload || !payload.id) {
            return NextResponse.json({ error: 'Invalid Token' }, { status: 401 })
        }

        const userId = payload.id as string
        const now = new Date()

        // Today start
        const today = new Date(now)
        today.setHours(0, 0, 0, 0)

        // Week start (Monday)
        const weekStart = new Date(now)
        const dayOfWeek = weekStart.getDay()
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        weekStart.setDate(weekStart.getDate() - diff)
        weekStart.setHours(0, 0, 0, 0)

        // Month start
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        monthStart.setHours(0, 0, 0, 0)

        // Get work orders assigned to user (active)
        const workOrdersAssigned = await prisma.workOrders.count({
            where: {
                assignedToId: userId,
                status: { in: ['ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'] }
            }
        })

        // Get pending work orders (available to take)
        const workOrdersPending = await prisma.workOrders.count({
            where: {
                status: 'PENDING',
                assignedToId: null
            }
        })

        // WO completed TODAY by user
        const woCompletedToday = await prisma.workOrders.count({
            where: {
                assignedToId: userId,
                status: 'COMPLETED',
                completedAt: { gte: today }
            }
        })

        // WO completed THIS WEEK by user
        const woCompletedWeek = await prisma.workOrders.count({
            where: {
                assignedToId: userId,
                status: 'COMPLETED',
                completedAt: { gte: weekStart }
            }
        })

        // WO completed THIS MONTH by user
        const woCompletedMonth = await prisma.workOrders.count({
            where: {
                assignedToId: userId,
                status: 'COMPLETED',
                completedAt: { gte: monthStart }
            }
        })

        // Get barang keluar today by user
        const barangKeluarToday = await prisma.barangKeluar.count({
            where: {
                userId,
                tanggal: { gte: today }
            }
        })

        // Get barang masuk today by user
        const barangMasukToday = await prisma.barangMasuk.count({
            where: {
                userId,
                tanggal: { gte: today }
            }
        })

        return NextResponse.json({
            workOrdersAssigned,
            workOrdersPending,
            woCompletedToday,
            woCompletedWeek,
            woCompletedMonth,
            barangKeluarToday,
            barangMasukToday
        })
    } catch (error) {
        console.error('Error fetching mobile dashboard stats:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
