import { prisma } from '@/lib/prisma'

interface ExpoPushMessage {
    to: string
    title: string
    body: string
    data?: Record<string, unknown>
    sound?: 'default' | null
    badge?: number
    channelId?: string
}

interface ExpoPushTicket {
    status: 'ok' | 'error'
    id?: string
    message?: string
    details?: unknown
}

/**
 * Send push notification to a specific user via Expo Push API
 */
export async function sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>
): Promise<boolean> {
    try {
        // Get user's push token
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { pushToken: true }
        })

        if (!user?.pushToken) {
            console.log(`[Push] No push token for user ${userId}`)
            return false
        }

        return await sendExpoPush([{
            to: user.pushToken,
            title,
            body,
            data: data || {},
            sound: 'default'
        }])


    } catch (error) {
        console.error('[Push] Error sending notification:', error)
        return false
    }
}

/**
 * Send push notification to multiple users
 */
export async function sendPushToUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>
): Promise<number> {
    try {
        // Get all users' push tokens
        const users = await prisma.user.findMany({
            where: { 
                id: { in: userIds },
                pushToken: { not: null }
            },
            select: { id: true, pushToken: true }
        })

        if (users.length === 0) {
            console.log('[Push] No users with push tokens')
            return 0
        }

        const messages: ExpoPushMessage[] = users.map(user => ({
            to: user.pushToken!,
            title,
            body,
            data: data || {},
            sound: 'default'
        }))

        await sendExpoPush(messages)
        return users.length
    } catch (error) {
        console.error('[Push] Error sending notifications:', error)
        return 0
    }
}

/**
 * Send push notifications via Expo Push API
 */
async function sendExpoPush(messages: ExpoPushMessage[]): Promise<boolean> {
    if (messages.length === 0) return false

    // Expo recommends batching in chunks of 100
    const chunks: ExpoPushMessage[][] = []
    for (let i = 0; i < messages.length; i += 100) {
        chunks.push(messages.slice(i, i + 100))
    }

    try {
        for (const chunk of chunks) {

            const response = await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Accept-Encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(chunk)
            })

            const result = await response.json()
            
            if (result.data) {
                const tickets = result.data as ExpoPushTicket[]
                tickets.forEach((ticket, index) => {
                    if (ticket.status === 'error') {
                        console.error(`[Push] Error for message ${index}:`, ticket.message, ticket.details)
                    } else {
                        console.log(`[Push] Sent successfully, ticket: ${ticket.id}`)
                    }
                })
            }
        }
        return true
    } catch (error) {
        console.error('[Push] Expo API error:', error)
        return false
    }
}

/**
 * Convenience function to send push when creating notifications
 * Call this after createNotification() in your services
 */
export async function sendPushForNotification(
    userId: string,
    title: string,
    message: string,
    link?: string,
    sourceType?: string,
    sourceId?: string
): Promise<void> {
    await sendPushNotification(userId, title, message, {
        link,
        sourceType,
        sourceId
    })
}

/**
 * Send push notification to all users in a department
 */
export async function sendPushToDepartment(
    departmentId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>
): Promise<number> {
    try {
        // Get all users in department with push tokens
        const users = await prisma.user.findMany({
            where: { 
                departmentId,
                isActive: true,
                pushToken: { not: null }
            },
            select: { id: true, pushToken: true }
        })

        if (users.length === 0) {
            console.log(`[Push] No users with push tokens in department ${departmentId}`)
            return 0
        }

        const messages: ExpoPushMessage[] = users.map(user => ({
            to: user.pushToken!,
            title,
            body,
            data: data || {},
            sound: 'default'
        }))

        await sendExpoPush(messages)
        console.log(`[Push] Sent to ${users.length} users in department ${departmentId}`)
        return users.length
    } catch (error) {
        console.error('[Push] Error sending to department:', error)
        return 0
    }
}
