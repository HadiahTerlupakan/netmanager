import { NextRequest, NextResponse } from 'next/server'
import { verifyMobileToken } from '@/lib/mobile-auth'
import { getNotificationsForUser, getUnreadCount, markAsRead, markAllAsRead } from '@/modules/notification'

// GET - Get notifications for current user
export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')
        
        if (!token) {
            return NextResponse.json({ error: 'Token required' }, { status: 401 })
        }
        
        const user = await verifyMobileToken(token)
        if (!user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }

        const { notifications, total } = await getNotificationsForUser(user.id, {
            limit: 50
        })

        const unreadCount = await getUnreadCount(user.id)

        return NextResponse.json({
            success: true,
            data: {
                notifications: notifications.map(n => {
                    let link = n.link

                    // Fix links for mobile navigation
                    if (n.sourceType === 'WORK_ORDER' && n.sourceId) {
                        link = `/(app)/work-order-detail/${n.sourceId}`
                    } else if (n.sourceType === 'LEAVE') {
                        link = '/(app)/izin'
                    } else if (n.sourceType === 'OVERTIME') {
                        link = '/(app)/lembur'
                    } else if (n.sourceType === 'INVENTORY') {
                        link = '/(app)/barang'
                    }

                    return {
                        id: n.id,
                        type: n.type,
                        title: n.title,
                        message: n.message,
                        link: link,
                        isRead: n.isRead,
                        sourceType: n.sourceType,
                        sourceId: n.sourceId,
                        createdAt: n.createdAt.toISOString()
                    }
                }),
                unreadCount,
                total
            }
        })
    } catch (error: any) {
        console.error('Error fetching notifications:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// POST - Mark notification(s) as read
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')
        
        if (!token) {
            return NextResponse.json({ error: 'Token required' }, { status: 401 })
        }
        
        const user = await verifyMobileToken(token)
        if (!user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }

        const body = await request.json()
        const { action, notificationId } = body

        if (action === 'markAllRead') {
            await markAllAsRead(user.id)
            return NextResponse.json({ success: true, message: 'All notifications marked as read' })
        } else if (action === 'markRead' && notificationId) {
            await markAsRead(notificationId)
            return NextResponse.json({ success: true, message: 'Notification marked as read' })
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    } catch (error: any) {
        console.error('Error updating notifications:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
