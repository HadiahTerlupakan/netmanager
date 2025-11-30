import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'

// Mock notifications data (replace with database queries later)
const mockNotifications = [
    {
        id: '1',
        type: 'work_order',
        priority: 'high',
        title: 'New Work Order Assigned',
        message: 'Work Order #WO-20241130-001 has been assigned to your department (IT)',
        read: false,
        link: '/employee/workorders',
        createdAt: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
    },
    {
        id: '2',
        type: 'work_order',
        priority: 'urgent',
        title: 'Urgent: Installation Required',
        message: 'Customer installation at Jl. Sudirman requires immediate attention',
        read: false,
        link: '/employee/workorders',
        createdAt: new Date(Date.now() - 7200000).toISOString() // 2 hours ago
    },
    {
        id: '3',
        type: 'system',
        priority: 'normal',
        title: 'Attendance Reminder',
        message: 'Don\'t forget to check out at the end of your shift',
        read: true,
        link: '/employee/attendance',
        createdAt: new Date(Date.now() - 86400000).toISOString() // 1 day ago
    },
]

// GET /api/notifications - Get all notifications for current user
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authConfig)

        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // TODO: Replace with actual database query
        // const notifications = await prisma.notification.findMany({
        //     where: {
        //         userId: session.user.id,
        //     },
        //     orderBy: {
        //         createdAt: 'desc',
        //     },
        // })

        return NextResponse.json(mockNotifications)
    } catch (error) {
        console.error('Error fetching notifications:', error)
        return NextResponse.json(
            { error: 'Failed to fetch notifications' },
            { status: 500 }
        )
    }
}

// GET /api/notifications/unread-count - Get unread count
export async function HEAD(request: NextRequest) {
    try {
        const session = await getServerSession(authConfig)

        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // TODO: Replace with actual database query
        // const count = await prisma.notification.count({
        //     where: {
        //         userId: session.user.id,
        //         read: false,
        //     },
        // })

        const count = mockNotifications.filter(n => !n.read).length

        return NextResponse.json({ count })
    } catch (error) {
        console.error('Error fetching unread count:', error)
        return NextResponse.json(
            { error: 'Failed to fetch unread count' },
            { status: 500 }
        )
    }
}
