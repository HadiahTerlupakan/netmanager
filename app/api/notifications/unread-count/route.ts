import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'

// GET /api/notifications/unread-count - Get unread notification count
export async function GET(request: NextRequest) {
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

        // Mock data - replace with actual count
        const count = 2

        return NextResponse.json({ count })
    } catch (error) {
        console.error('Error fetching unread count:', error)
        return NextResponse.json(
            { error: 'Failed to fetch unread count' },
            { status: 500 }
        )
    }
}
