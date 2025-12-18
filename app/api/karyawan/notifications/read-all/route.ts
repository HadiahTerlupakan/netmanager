import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { markAllAsRead } from '@/modules/notification';

// POST - Mark all notifications as read
export async function POST(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        await markAllAsRead(session.user.id)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error marking all notifications as read:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
