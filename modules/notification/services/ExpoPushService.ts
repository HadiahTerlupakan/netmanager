import { prisma } from '@/lib/prisma'
import { enqueuePushRetry } from './PushRetryQueue'

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
        // Enqueue for retry
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { pushToken: true }
        })
        if (user?.pushToken) {
            enqueuePushRetry({
                type: 'expo',
                userId,
                title,
                body,
                data,
                pushToken: user.pushToken,
            })
        }
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
 * Includes throttling between chunks and per-ticket error handling
 */
async function sendExpoPush(messages: ExpoPushMessage[]): Promise<boolean> {
    if (messages.length === 0) return false

    // Expo recommends batching in chunks of 100
    const chunks: ExpoPushMessage[][] = []
    for (let i = 0; i < messages.length; i += 100) {
        chunks.push(messages.slice(i, i + 100))
    }

    let allSucceeded = true

    try {
        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
            const chunk = chunks[chunkIndex]

            // Throttle: wait 200ms between chunks to avoid overwhelming Expo API
            if (chunkIndex > 0) {
                await new Promise(resolve => setTimeout(resolve, 200))
            }

            try {
                const response = await fetch('https://exp.host/--/api/v2/push/send', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Accept-Encoding': 'gzip, deflate',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(chunk)
                })

                if (!response.ok) {
                    console.error(`[Push] Expo API HTTP error ${response.status} for chunk ${chunkIndex + 1}/${chunks.length}`)
                    allSucceeded = false
                    continue
                }

                const result = await response.json()

                if (result.data) {
                    const tickets = result.data as ExpoPushTicket[]
                    tickets.forEach((ticket, index) => {
                        if (ticket.status === 'error') {
                            console.error(`[Push] Error for chunk ${chunkIndex + 1} message ${index}:`, ticket.message, ticket.details)
                            allSucceeded = false
                        }
                    })
                }

                console.log(`[Push] Chunk ${chunkIndex + 1}/${chunks.length} sent (${chunk.length} messages)`)
            } catch (chunkError) {
                console.error(`[Push] Failed to send chunk ${chunkIndex + 1}/${chunks.length}:`, chunkError)
                allSucceeded = false
                // Continue with next chunk instead of aborting all
            }
        }
        return allSucceeded
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
