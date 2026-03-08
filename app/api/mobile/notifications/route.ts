import { NextRequest, NextResponse } from 'next/server'
import { getMobileAuthPayload } from '@/lib/mobile-api-auth'
import { getNotificationsForUser, getUnreadCount, markAsRead, markAllAsRead } from '@/modules/notification'

// GET - Get notifications for current user
export async function GET(request: NextRequest) {
    try {
        const authResult = await getMobileAuthPayload(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const userId = authResult.userId as string
        if (!userId) {
            return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
        }

        const { notifications, total } = await getNotificationsForUser(userId, {
            limit: 50
        })

        const unreadCount = await getUnreadCount(userId)

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
    } catch (error: unknown) {
        console.error('Error fetching notifications:', error)
        const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}

// POST - Mark notification(s) as read
export async function POST(request: NextRequest) {
    try {
        const authResult = await getMobileAuthPayload(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const userId = authResult.userId as string
        if (!userId) {
            return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
        }

        const body = await request.json()
        const { action, notificationId } = body

        if (action === 'markAllRead') {
            await markAllAsRead(userId)
            return NextResponse.json({ success: true, message: 'Semua notifikasi ditandai sudah dibaca' })
        } else if (action === 'markRead' && notificationId) {
            await markAsRead(notificationId)
            return NextResponse.json({ success: true, message: 'Notifikasi ditandai sudah dibaca' })
        }

        return NextResponse.json({ error: 'Aksi tidak valid' }, { status: 400 })
    } catch (error: unknown) {
        console.error('Error updating notifications:', error)
        const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}
