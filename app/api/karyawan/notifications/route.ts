import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getNotificationsForUser, getUnreadCount } from '@/modules/notification';

// GET - Get notifications for current user
export async function GET(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { notifications, total } = await getNotificationsForUser(session.user.id, {
            limit: 20
        })

        const unreadCount = await getUnreadCount(session.user.id)

        return NextResponse.json({
            notifications: notifications.map(n => {
                let link = n.link

                // Fix link for Karyawan Portal
                if (n.sourceType === 'WORK_ORDER' && n.sourceId) {
                    link = `/karyawan/work-order/${n.sourceId}`
                } else if (link) {
                    // Fallback string replacements
                    link = link
                        .replace('/admin/workorders', '/karyawan/work-order')
                        .replace('/admin/work-order', '/karyawan/work-order')
                }

                return {
                    id: n.id,
                    type: n.type,
                    title: n.title,
                    message: n.message,
                    link: link,
                    isRead: n.isRead,
                    createdAt: n.createdAt.toISOString()
                }
            }),
            unreadCount,
            total
        })
    } catch (error) {
        console.error('Error fetching notifications:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
